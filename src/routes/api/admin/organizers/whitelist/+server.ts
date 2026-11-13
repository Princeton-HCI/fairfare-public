import { json, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { requireAdminApi } from '@src/lib/server/adminAuth';
import { logAdminAction } from '@src/lib/server/adminAudit';
import {
  HttpError,
  handleApiError,
  postgresHttpError,
  readJsonBody,
  stringField
} from '@src/lib/server/apiErrors';
import {
  authPhonesByUserId,
  upsertOrganizationMembership
} from '@src/lib/server/organizationMembership';
import { findUserIdByPhone } from '@src/lib/databaseHelpers';
import { parseOrganizationRole, type OrganizationRole } from '@src/lib/rbac';
import { stripPhoneNumberStringOfNonDigits } from '@src/lib/utils';

/**
 * Add a phone number to an organization's organizer whitelist with the role the
 * person should get when they first log in (`invited_role`). This is how the
 * first Organizer administrator of an organization is onboarded: the platform
 * admin whitelists them as `lead_organizer`, they log in with the organization's
 * signup code, and `verify-otp` creates the membership with that role.
 *
 * The login flow looks the number up by its canonical digits-only form (e.g.
 * `15555551234`), so we normalize on the way in — otherwise a formatted entry
 * like `+1 (555) 555-1234` would never match at login. Re-adding an existing
 * entry updates its invited role.
 *
 * Whitelisting someone who has already joined does not change the role they
 * hold — that goes through the team page, or through the role control on
 * /admin/organizers — so the response reports the role actually in effect
 * alongside the one that was requested.
 */
export const POST = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_users');

  try {
    const body = await readJsonBody(request);
    const phoneNumber = stripPhoneNumberStringOfNonDigits(stringField(body, 'phoneNumber'));
    const organizationId = stringField(body, 'organizationId');
    const role = parseOrganizationRole(body?.role) ?? 'organizer';

    if (!phoneNumber) throw new HttpError('phoneNumber is required', 400);
    if (!organizationId) throw new HttpError('organizationId is required', 400);

    const { data: organization } = await supabase
      .from('affiliate_organizations')
      .select('key')
      .eq('id', organizationId)
      .maybeSingle();
    if (!organization) throw new HttpError('Organization not found', 404);

    const { error } = await supabase.from('organizer_affiliations_phone_whitelist').upsert(
      {
        phone_number: phoneNumber,
        affiliate_organization_id: organizationId,
        invited_role: role
      },
      { onConflict: 'affiliate_organization_id, phone_number' }
    );

    if (error) {
      console.error('Error adding whitelist entry:', error);
      throw new HttpError('Failed to add whitelist entry', 500);
    }

    // If this phone already belongs to a System user who is not yet a member,
    // create the membership now so they do not have to log in again to get it.
    // Existing members keep their current role: changing it goes through the
    // affiliation endpoint, which writes the membership row directly.
    const inviteeUserId = await findUserIdByPhone(supabase, phoneNumber);

    let membershipCreated = false;
    // The role this call actually put in effect. It diverges from `role` when
    // the person is already a member: the upsert leaves their row alone, so
    // reporting the requested role would tell the admin they had just made
    // someone a lead organizer when nothing about their access changed.
    let effectiveRole: OrganizationRole = role;

    if (inviteeUserId) {
      try {
        membershipCreated = await upsertOrganizationMembership(supabase, {
          userId: inviteeUserId,
          organizationId,
          role,
          createdBy: admin.user.id
        });
      } catch (memberError) {
        console.error('Error creating membership from whitelist:', memberError);
        throw new HttpError('Failed to create membership', 500);
      }

      if (!membershipCreated) {
        const { data: existing, error: existingError } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', inviteeUserId)
          .eq('organization_id', organizationId)
          .maybeSingle();
        // A failed read would fall back to the requested role and report exactly
        // the promotion that did not happen, which is what this block exists to
        // avoid — so log it rather than letting it pass unnoticed.
        if (existingError) {
          console.error('Failed to read the existing membership role:', existingError);
        }
        effectiveRole = parseOrganizationRole(existing?.role) ?? effectiveRole;
      }
    }

    // False when the person was already a member with a different role.
    const requestedRoleApplied = effectiveRole === role;

    await logAdminAction(admin, {
      action: 'organizer.whitelist_add',
      targetType: 'organizer',
      targetId: organizationId,
      metadata: { phoneNumber, role, effectiveRole, membershipCreated }
    });

    return json({
      success: true,
      role: effectiveRole,
      invitedRole: role,
      membershipCreated,
      // Lets the admin UI say so instead of reporting a promotion that did not
      // happen; changing an existing member's role goes through the team page.
      requestedRoleApplied
    });
  } catch (error) {
    return handleApiError(error, 'Failed to add whitelist entry');
  }
};

/**
 * Resolve the member of `organizationId` whose login phone is `phoneNumber`,
 * if any. Checks `profiles.phone` first, then the auth-user phone of each member
 * (covers profiles created before the auth trigger started copying the phone).
 */
async function findMemberUserIdByPhone(
  organizationId: string,
  phoneNumber: string
): Promise<string | null> {
  const [profileUserId, { data: members }] = await Promise.all([
    findUserIdByPhone(supabase, phoneNumber),
    supabase.from('organization_members').select('user_id').eq('organization_id', organizationId)
  ]);

  const memberUserIds = (members ?? []).map((m) => m.user_id);
  if (profileUserId && memberUserIds.includes(profileUserId)) {
    return profileUserId;
  }

  const authPhones = await authPhonesByUserId(supabase, memberUserIds);
  for (const [userId, phone] of authPhones) {
    if (stripPhoneNumberStringOfNonDigits(phone) === phoneNumber) return userId;
  }
  return null;
}

export const DELETE = async ({ locals, url }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_users');

  try {
    const rawPhoneNumber = url.searchParams.get('phoneNumber');
    const phoneNumber = rawPhoneNumber ? stripPhoneNumberStringOfNonDigits(rawPhoneNumber) : '';
    const organizationId = url.searchParams.get('organizationId');
    if (!phoneNumber || !organizationId) {
      throw new HttpError('phoneNumber and organizationId are required', 400);
    }

    // Route through the membership RPCs so removal takes the organization lock
    // and, when the phone has already joined, drops the membership too (the
    // trigger clears its login grant in the same transaction). A bare whitelist
    // delete left the member with live access and only blocked their next login.
    const memberUserId = await findMemberUserIdByPhone(organizationId, phoneNumber);
    let membershipRemoved = false;

    if (memberUserId) {
      const { error } = await locals.supabase.rpc('remove_organization_member', {
        p_organization_id: organizationId,
        p_user_id: memberUserId
      });
      if (error) {
        console.error('Error removing membership:', error);
        throw postgresHttpError(error, 'Failed to remove membership');
      }
      membershipRemoved = true;
    } else {
      const { error } = await locals.supabase.rpc('revoke_organization_invite', {
        p_organization_id: organizationId,
        p_phone: phoneNumber
      });
      if (error) {
        console.error('Error removing whitelist entry:', error);
        throw new HttpError('Failed to remove whitelist entry', 500);
      }
    }

    await logAdminAction(admin, {
      action: 'organizer.whitelist_remove',
      targetType: 'organizer',
      targetId: organizationId,
      metadata: { phoneNumber, membershipRemoved }
    });

    return json({ success: true, membershipRemoved });
  } catch (error) {
    return handleApiError(error, 'Failed to remove whitelist entry');
  }
};
