import { fail } from '@sveltejs/kit';
import { supabase as serverSupabase } from '@src/lib/server/db';
import { requireCapability } from '@src/lib/server/rbac';
import { authPhonesByUserId, logOrganizerAction } from '@src/lib/server/organizationMembership';
import { getOrganizationByKey } from '@src/lib/server/organizationArgyle';
import { profilesByUserId } from '@src/lib/databaseHelpers';
import { stripPhoneNumberStringOfNonDigits } from '@src/lib/utils';
import { parseOrganizationRole } from '@src/lib/rbac';

async function orgIdForKey(organizationKey: string): Promise<string | null> {
  return (await getOrganizationByKey(organizationKey))?.id ?? null;
}

/**
 * Gate a team action and resolve the organization it targets. Every action here
 * needs the same two things, so the guard cannot be forgotten on a new one.
 */
async function authorizeTeamAction(locals: App.Locals, organizationKey: string) {
  const { user, roles } = await locals.safeGetSession();
  // An anonymous request carries an empty auth context, so this throws 403
  // before `user` can be null — every action below can rely on it.
  requireCapability(roles, 'org:manage_members', organizationKey);
  return { user: user!, organizationId: await orgIdForKey(organizationKey) };
}

/**
 * Membership RPCs raise `P0001` for a rule the organizer broke. The only one the
 * UI words itself is the last-lead guard, which it keys on this sentinel.
 */
function membershipActionFailure(error: { message: string }) {
  return fail(400, {
    error: error.message.includes('last lead') ? 'last-lead' : error.message
  });
}

export async function load({ locals, params }) {
  const { roles } = await locals.safeGetSession();
  requireCapability(roles, 'org:manage_members', params.affiliate_organization_key);

  const organizationId = await orgIdForKey(params.affiliate_organization_key);
  if (!organizationId) {
    return { members: [], pendingInvites: [], organizationId: null };
  }

  const [{ data: members }, { data: whitelist }] = await Promise.all([
    serverSupabase
      .from('organization_members')
      .select('user_id, role, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true }),
    serverSupabase
      .from('organizer_affiliations_phone_whitelist')
      .select('phone_number, invited_role, created_at')
      .eq('affiliate_organization_id', organizationId)
      .order('created_at', { ascending: false })
  ]);

  const userIds = (members ?? []).map((m) => m.user_id);
  const profileByUserId = await profilesByUserId<{
    user_id: string;
    phone: string | null;
    email: string | null;
    first_name: string | null;
  }>(serverSupabase, userIds, 'user_id, phone, email, first_name');

  // Organizers created through the OTP flow have their phone on the auth user,
  // not on `profiles`. Read it from there so the members table shows a phone and
  // so their own whitelist row is recognized as joined (and dropped from the
  // pending-invites list) instead of looking like an unaccepted invite.
  const authPhoneByUserId = await authPhonesByUserId(serverSupabase, userIds);

  const phoneForUser = (userId: string): string | null =>
    authPhoneByUserId.get(userId) ?? profileByUserId.get(userId)?.phone ?? null;

  const memberPhones = new Set(
    userIds
      .map((userId) => stripPhoneNumberStringOfNonDigits(phoneForUser(userId) ?? ''))
      .filter((phone) => phone.length > 0)
  );

  return {
    organizationId,
    members: (members ?? []).map((member) => ({
      ...member,
      phone: phoneForUser(member.user_id),
      profile: profileByUserId.get(member.user_id) ?? null
    })),
    // Normalize both sides: `memberPhones` is stripped, so comparing a raw
    // whitelist value would leave an already-joined member listed as pending
    // forever (and "Revoke" on that row, which strips before calling the RPC,
    // would then match nothing and silently do nothing).
    pendingInvites: (whitelist ?? []).filter(
      (row) => !memberPhones.has(stripPhoneNumberStringOfNonDigits(row.phone_number ?? ''))
    )
  };
}

export const actions = {
  invite: async ({ request, locals, params }) => {
    const { user, organizationId } = await authorizeTeamAction(
      locals,
      params.affiliate_organization_key
    );
    if (!organizationId) return fail(400, { error: 'Organization not found' });

    const form = await request.formData();
    const phone = stripPhoneNumberStringOfNonDigits(String(form.get('phone') ?? ''));
    const role = parseOrganizationRole(form.get('role'));
    if (!role) return fail(400, { error: 'Invalid role' });

    // The RPC turns the invite into a live membership straight away when the
    // phone already has a System account. Measure that by the member count
    // across the call rather than resolving the phone here: the RPC matches on
    // `auth.users.phone` first and `profiles.phone` second, and reproducing
    // that means either missing every organizer onboarded over OTP (whose phone
    // is only on the auth user) or paginating all auth users on each invite.
    // Only the audit field below reads it, so a concurrent invite to the same
    // organization landing between the two counts is an acceptable cost.
    const countMembers = async (): Promise<number> => {
      const { count } = await serverSupabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);
      return count ?? 0;
    };
    const membersBefore = await countMembers();

    const { error } = await locals.supabase.rpc('invite_organization_member', {
      p_organization_id: organizationId,
      p_phone: phone,
      p_role: role
    });
    if (error) {
      console.error('invite_organization_member', error);
      return membershipActionFailure(error);
    }

    await logOrganizerAction(serverSupabase, {
      userId: user.id,
      action: 'invited_member',
      additionalData: {
        organizationKey: params.affiliate_organization_key,
        phone,
        role,
        membershipCreated: (await countMembers()) > membersBefore
      }
    });

    return { invited: true };
  },

  revokeInvite: async ({ request, locals, params }) => {
    const { organizationId } = await authorizeTeamAction(locals, params.affiliate_organization_key);
    if (!organizationId) return fail(400, { error: 'Organization not found' });

    const form = await request.formData();
    const phone = stripPhoneNumberStringOfNonDigits(String(form.get('phone') ?? ''));

    const { error } = await locals.supabase.rpc('revoke_organization_invite', {
      p_organization_id: organizationId,
      p_phone: phone
    });
    if (error) {
      console.error('revoke_organization_invite', error);
      return membershipActionFailure(error);
    }
    return { inviteRevoked: true };
  },

  setRole: async ({ request, locals, params }) => {
    const { user, organizationId } = await authorizeTeamAction(
      locals,
      params.affiliate_organization_key
    );
    if (!organizationId) return fail(400, { error: 'Organization not found' });

    const form = await request.formData();
    const userId = String(form.get('userId') ?? '');
    const role = parseOrganizationRole(form.get('role'));
    if (!role) return fail(400, { error: 'Invalid role' });

    const { error } = await locals.supabase.rpc('set_organization_member_role', {
      p_organization_id: organizationId,
      p_user_id: userId,
      p_role: role
    });
    if (error) {
      return membershipActionFailure(error);
    }

    await logOrganizerAction(serverSupabase, {
      userId: user.id,
      action: 'member_role_changed',
      additionalData: {
        organizationKey: params.affiliate_organization_key,
        targetUserId: userId,
        role
      }
    });

    return { roleUpdated: true };
  },

  remove: async ({ request, locals, params }) => {
    const { user, organizationId } = await authorizeTeamAction(
      locals,
      params.affiliate_organization_key
    );
    if (!organizationId) return fail(400, { error: 'Organization not found' });

    const form = await request.formData();
    const userId = String(form.get('userId') ?? '');

    const { error } = await locals.supabase.rpc('remove_organization_member', {
      p_organization_id: organizationId,
      p_user_id: userId
    });
    if (error) {
      return membershipActionFailure(error);
    }

    await logOrganizerAction(serverSupabase, {
      userId: user.id,
      action: 'member_removed',
      additionalData: {
        organizationKey: params.affiliate_organization_key,
        targetUserId: userId
      }
    });

    return { removed: true };
  }
};
