/**
 * Checks if all of the the driver's accounts have been synced.
 * @param driverProfileWithDetails The driver's profile with the accounts
 * @returns {boolean} True if all of the accounts have been synced.
 */
export const driverHasSynced = (driverProfileWithDetails: ProfileWithDetails) => {
  if (
    !driverProfileWithDetails.argyle_accounts ||
    driverProfileWithDetails.argyle_accounts.length === 0
  ) {
    // return false if there are no accounts
    return false;
  }
  return driverProfileWithDetails.argyle_accounts.every(
    (account) => account.all_gigs_last_synced_at
  );
};

export type ProfileWithDetails = SupabaseRows['profiles'] & {
  driver_affiliate_organization_data_sharing_consents: {
    created_at: string;
    affiliate_organization: {
      name: string;
      key: string;
    };
  }[];
  argyle_accounts: {
    all_gigs_last_synced_at: string;
  }[];
};
