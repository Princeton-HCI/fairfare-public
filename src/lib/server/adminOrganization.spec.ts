import { describe, expect, it } from 'vitest';
import { organizationForAdminPage } from './adminOrganization';

const organization = {
  id: 'org-1',
  key: 'du',
  signup_code: 'organizer-secret',
  driver_signup_code: 'driver-secret'
};

describe('organizationForAdminPage', () => {
  it('does not serialize signup codes for researchers', () => {
    const result = organizationForAdminPage(organization, false);

    expect(result).toEqual({
      id: 'org-1',
      key: 'du',
      signupCode: null,
      driverSignupCode: null,
      hasSignupCode: true,
      hasDriverSignupCode: true
    });
    expect(result).not.toHaveProperty('signup_code');
    expect(result).not.toHaveProperty('driver_signup_code');
    expect(JSON.stringify(result)).not.toContain('organizer-secret');
    expect(JSON.stringify(result)).not.toContain('driver-secret');
  });

  it('includes signup codes for platform administrators', () => {
    expect(organizationForAdminPage(organization, true)).toMatchObject({
      signupCode: 'organizer-secret',
      driverSignupCode: 'driver-secret',
      hasSignupCode: true,
      hasDriverSignupCode: true
    });
  });
});
