import { json, type RequestEvent } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { requireAdminApi } from '@src/lib/server/adminAuth';
import { logAdminAction } from '@src/lib/server/adminAudit';
import { HttpError, handleApiError, readJsonBody, stringField } from '@src/lib/server/apiErrors';
import { generateSignupCode } from '@src/lib/server/signupCode';

/**
 * Set, regenerate, or remove an organization's signup codes.
 *  - `regenerate: true`          → new random organizer signup_code
 *  - `signupCode: string`        → set organizer signup_code to this value
 *  - `clearSignupCode: true`     → remove organizer signup_code (disables organizer signups)
 *  - `driverSignupCode: string`  → set driver signup gate code (null/'' clears)
 */
export const POST = async ({ locals, request }: RequestEvent) => {
  const admin = await requireAdminApi(locals, 'platform:manage_orgs');

  try {
    const body = await readJsonBody(request);
    const key = stringField(body, 'key');
    if (!key) throw new HttpError('key is required', 400);

    const updates: { signup_code?: string | null; driver_signup_code?: string | null } = {};
    const signupCode = stringField(body, 'signupCode');

    if (body?.clearSignupCode === true) {
      // Removing the organizer signup code disables organizer signups for this org.
      updates.signup_code = null;
    } else if (body?.regenerate === true) {
      updates.signup_code = generateSignupCode();
    } else if (signupCode) {
      updates.signup_code = signupCode;
    }

    if ('driverSignupCode' in (body ?? {})) {
      updates.driver_signup_code = stringField(body, 'driverSignupCode') || null;
    }

    if (Object.keys(updates).length === 0) throw new HttpError('Nothing to update', 400);

    const { data, error } = await supabase
      .from('affiliate_organizations')
      .update(updates)
      .eq('key', key)
      .select('id, key, signup_code, driver_signup_code')
      .maybeSingle();

    if (error) {
      console.error('Error rotating signup code:', error);
      throw new HttpError('Failed to update signup code', 500);
    }
    // An unknown key updates nothing; reporting that as a 500 hides a typo.
    if (!data) throw new HttpError('Organization not found', 404);

    await logAdminAction(admin, {
      action: 'organization.rotate_code',
      targetType: 'organization',
      targetId: key,
      metadata: { fields: Object.keys(updates) }
    });

    return json({
      success: true,
      signupCode: data.signup_code,
      driverSignupCode: data.driver_signup_code
    });
  } catch (error) {
    return handleApiError(error, 'Failed to update signup code');
  }
};
