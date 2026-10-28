type OrganizationWithSignupCodes = {
  signup_code: string | null;
  driver_signup_code: string | null;
};

/**
 * Researchers may see whether signup codes are configured, but only platform
 * administrators may receive the credential values in an admin page payload.
 */
export function organizationForAdminPage<T extends OrganizationWithSignupCodes>(
  organization: T,
  canManage: boolean
) {
  const { signup_code, driver_signup_code, ...safeOrganization } = organization;

  return {
    ...safeOrganization,
    signupCode: canManage ? signup_code : null,
    driverSignupCode: canManage ? driver_signup_code : null,
    hasSignupCode: !!signup_code,
    hasDriverSignupCode: !!driver_signup_code
  };
}
