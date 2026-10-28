import type { SupabaseClient } from '@supabase/supabase-js';

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
  is_billed_to_organization?: boolean;
  /** Set only by lists that show sync status; `false` means no live Argyle account. */
  has_argyle_sync?: boolean;
};

type PrimaryDriverRow = Omit<ProfileWithDetails, 'argyle_accounts'> & {
  argyle_accounts: { all_gigs_last_synced_at: string; organization_id: string | null }[];
};

/**
 * Every driver whose primary affiliation is this organization, i.e. the drivers
 * whose Argyle sync the organization owns. Pass the service-role client: the
 * affiliations table is readable only by the driver themselves, so the caller
 * must gate on `org:manage_argyle_settings` and this scopes rows to the org.
 */
export const getPrimaryAffiliatedDrivers = async (
  supabase: SupabaseClient,
  organizationId: string
): Promise<ProfileWithDetails[]> => {
  const [affiliations, profiles] = await Promise.all([
    supabase
      .from('driver_affiliate_organization_affiliations')
      .select('user_id')
      .eq('affiliate_organization_id', organizationId)
      .eq('is_primary', true),
    // Every affiliation is created alongside its consent, so the consent join
    // reaches every primary driver and gives the "Shared on" date for this org.
    supabase
      .from('profiles')
      .select(
        `
          *,
          argyle_accounts(
            all_gigs_last_synced_at,
            organization_id,
            deleted_at
          ),
          driver_affiliate_organization_data_sharing_consents!inner(
            created_at,
            affiliate_organization_id,
            affiliate_organization:affiliate_organizations(name, key)
          )
        `
      )
      .eq(
        'driver_affiliate_organization_data_sharing_consents.affiliate_organization_id',
        organizationId
      )
      .is('argyle_accounts.deleted_at', null)
      .returns<PrimaryDriverRow[]>()
  ]);

  if (affiliations.error || profiles.error || !affiliations.data || !profiles.data) {
    console.error('Error fetching primary-affiliated drivers:', {
      affiliationsError: affiliations.error,
      profilesError: profiles.error
    });
    return [];
  }

  const primaryUserIds = new Set(affiliations.data.map((a) => a.user_id));

  return profiles.data
    .filter((profile) => primaryUserIds.has(profile.user_id))
    .map((profile) => ({
      ...profile,
      is_billed_to_organization: profile.argyle_accounts.some(
        (account) => account.organization_id === organizationId
      ),
      has_argyle_sync: profile.argyle_accounts.length > 0
    }));
};

export const states = [
  {
    name: 'Alabama',
    abbreviation: 'AL'
  },
  {
    name: 'Alaska',
    abbreviation: 'AK'
  },
  {
    name: 'Arizona',
    abbreviation: 'AZ'
  },
  {
    name: 'Arkansas',
    abbreviation: 'AR'
  },
  {
    name: 'California',
    abbreviation: 'CA'
  },
  {
    name: 'Colorado',
    abbreviation: 'CO'
  },
  {
    name: 'Connecticut',
    abbreviation: 'CT'
  },
  {
    name: 'Delaware',
    abbreviation: 'DE'
  },
  {
    name: 'District Of Columbia',
    abbreviation: 'DC'
  },
  {
    name: 'Florida',
    abbreviation: 'FL'
  },
  {
    name: 'Georgia',
    abbreviation: 'GA'
  },
  {
    name: 'Hawaii',
    abbreviation: 'HI'
  },
  {
    name: 'Idaho',
    abbreviation: 'ID'
  },
  {
    name: 'Illinois',
    abbreviation: 'IL'
  },
  {
    name: 'Indiana',
    abbreviation: 'IN'
  },
  {
    name: 'Iowa',
    abbreviation: 'IA'
  },
  {
    name: 'Kansas',
    abbreviation: 'KS'
  },
  {
    name: 'Kentucky',
    abbreviation: 'KY'
  },
  {
    name: 'Louisiana',
    abbreviation: 'LA'
  },
  {
    name: 'Maine',
    abbreviation: 'ME'
  },
  {
    name: 'Maryland',
    abbreviation: 'MD'
  },
  {
    name: 'Massachusetts',
    abbreviation: 'MA'
  },
  {
    name: 'Michigan',
    abbreviation: 'MI'
  },
  {
    name: 'Minnesota',
    abbreviation: 'MN'
  },
  {
    name: 'Mississippi',
    abbreviation: 'MS'
  },
  {
    name: 'Missouri',
    abbreviation: 'MO'
  },
  {
    name: 'Montana',
    abbreviation: 'MT'
  },
  {
    name: 'Nebraska',
    abbreviation: 'NE'
  },
  {
    name: 'Nevada',
    abbreviation: 'NV'
  },
  {
    name: 'New Hampshire',
    abbreviation: 'NH'
  },
  {
    name: 'New Jersey',
    abbreviation: 'NJ'
  },
  {
    name: 'New Mexico',
    abbreviation: 'NM'
  },
  {
    name: 'New York',
    abbreviation: 'NY'
  },
  {
    name: 'North Carolina',
    abbreviation: 'NC'
  },
  {
    name: 'North Dakota',
    abbreviation: 'ND'
  },
  {
    name: 'Ohio',
    abbreviation: 'OH'
  },
  {
    name: 'Oklahoma',
    abbreviation: 'OK'
  },
  {
    name: 'Oregon',
    abbreviation: 'OR'
  },
  {
    name: 'Pennsylvania',
    abbreviation: 'PA'
  },
  {
    name: 'Rhode Island',
    abbreviation: 'RI'
  },
  {
    name: 'South Carolina',
    abbreviation: 'SC'
  },
  {
    name: 'South Dakota',
    abbreviation: 'SD'
  },
  {
    name: 'Tennessee',
    abbreviation: 'TN'
  },
  {
    name: 'Texas',
    abbreviation: 'TX'
  },
  {
    name: 'Utah',
    abbreviation: 'UT'
  },
  {
    name: 'Vermont',
    abbreviation: 'VT'
  },
  {
    name: 'Virginia',
    abbreviation: 'VA'
  },
  {
    name: 'Washington',
    abbreviation: 'WA'
  },
  {
    name: 'West Virginia',
    abbreviation: 'WV'
  },
  {
    name: 'Wisconsin',
    abbreviation: 'WI'
  },
  {
    name: 'Wyoming',
    abbreviation: 'WY'
  }
];

export const getStateAbbrev = (name: string) => {
  for (let i = 0; i < states.length; i++) {
    if (states[i].name == name) return states[i].abbreviation;
  }
  return '';
};

export const getDriverIds = async (
  supabaseClient: SupabaseClient,
  organizationKey: string
): Promise<string[]> => {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select(
      `
        *,
        argyle_accounts(
          all_gigs_last_synced_at
        ),
        driver_affiliate_organization_data_sharing_consents!inner(
          created_at,
          affiliate_organization:affiliate_organizations!inner(
            name
          )
        )
      `
    )
    .eq(
      'driver_affiliate_organization_data_sharing_consents.affiliate_organizations.key',
      organizationKey
    )
    .overrideTypes<ProfileWithDetails[], { merge: false }>();

  if (error || data === null) {
    console.error(error);
    return [];
  }

  return data
    .filter((profile) => profile.first_name && profile.last_initial && profile.phone)
    .map((profile) => profile.user_id);
};

export const getDrivers = async (
  supabase: SupabaseClient,
  currentUserId: string,
  organizationKey: string
) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
        *,
        argyle_accounts(
          all_gigs_last_synced_at
        ),
        driver_affiliate_organization_data_sharing_consents!inner(
          created_at,
          affiliate_organization:affiliate_organizations!inner(
            name
          )
        )
      `
    )
    .neq('user_id', currentUserId)
    // make sure this is for the right organization, too
    .eq(
      'driver_affiliate_organization_data_sharing_consents.affiliate_organizations.key',
      organizationKey
    )
    .returns<ProfileWithDetails[]>();

  if (error || data === null) {
    console.error(error);
    return;
  }
  // sort by most recent consent date
  data.sort((a, b) => {
    const aDate = new Date(a.driver_affiliate_organization_data_sharing_consents[0].created_at);
    const bDate = new Date(b.driver_affiliate_organization_data_sharing_consents[0].created_at);
    return bDate.getTime() - aDate.getTime();
  });

  // remove the profiles that haven't had the identities synced
  return data.filter((profile) => {
    return profile.first_name! && profile.last_initial! && profile.phone!;
  });
};
