/**
 * This script makes a bunch of fake driver activities and an organizer to test
 * the organizer portal. It makes drivers and organizers for multiple organizations,
 * and creates drivers who did not successfully link their accounts to test
 * the dashboard functionality.
 *
 * Note: the seeds are DETERMINISTIC and are used in some tests.
 * Modifying this file may require tests to be updated.
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLastInitialsFromLastName } from '../src/lib/nameUtils.js';

// dotenv
import { config } from 'dotenv';
import { v3 } from 'uuid';
config();

const PUB_VITE_SUPABASE_URL = process.env.PUB_VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_DEFAULT_PASSWORD = process.env.SUPABASE_DEFAULT_PASSWORD;

// Sample addresses for locations
const SAMPLE_ADDRESSES = [
  'Westchester Ave, Queens, NY, US',
  'Times Square, New York, NY, US',
  'Grand Central Terminal, New York, NY, US',
  'Central Park, New York, NY, US',
  'Rockefeller Center, New York, NY, US',
  'Empire State Building, New York, NY, US',
  'Brooklyn Bridge, New York, NY, US',
  'Union Square, New York, NY, US',
  'Greenwich Village, New York, NY, US',
  'SoHo, New York, NY, US',
  'Wall Street, New York, NY, US',
  'World Trade Center, New York, NY, US'
];

// Deterministic random number generator
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

export const updateProfileByUserId = async (
  supabase: SupabaseClient,
  userId: string,
  updateData: Record<string, unknown>
) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('user_id', userId)
    .select('*');

  if (error) {
    console.error('Error updating profile:', error);
    throw error;
  }

  return data[0];
};

/**
 * Seeding has to survive being run twice. `createUser` rejects an email that
 * already exists, which used to abort the whole seed — so a warm database could
 * only be re-seeded after `supabase db reset`, and tests/organizerPortal.spec.ts
 * failed in its `beforeAll` on any second local run.
 */
const createOrAdoptUser = async (
  supabase: SupabaseClient,
  params: { email: string; password: string | undefined }
) => {
  const { data, error } = await supabase.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true
  });
  if (!error && data.user) return data.user;

  let page = 1;
  const perPage = 500;
  while (true) {
    const {
      data: { users }
    } = await supabase.auth.admin.listUsers({ page, perPage });
    const existing = users.find((user) => user.email === params.email);
    if (existing) return existing;
    if (users.length < perPage) {
      throw error ?? new Error(`Failed to create or find user ${params.email}`);
    }
    page++;
  }
};

/** Activities for the First Last DU driver; default matches manual/CLI load testing. */
export const DEFAULT_DU_HIGH_VOLUME_ACTIVITY_COUNT = 30_000;

/** Lower volume for Playwright so seeding stays under hook timeouts on CI. */
export const DU_HIGH_VOLUME_ACTIVITY_COUNT_FOR_TESTS = 5_000;

export type MakeOrganizersSeedsOptions = {
  /** Override high-volume driver row count (e.g. lower for Playwright to avoid CI timeouts). */
  duHighVolumeActivityCount?: number;
};

/**
 * @param options.duHighVolumeActivityCount — defaults to {@link DEFAULT_DU_HIGH_VOLUME_ACTIVITY_COUNT}
 */
const makeOrganizersSeeds = async (options?: MakeOrganizersSeedsOptions) => {
  const duHighVolumeActivityCount =
    options?.duHighVolumeActivityCount ?? DEFAULT_DU_HIGH_VOLUME_ACTIVITY_COUNT;

  if (!PUB_VITE_SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Environment variables not set.');
  }

  // Confirm that we're not running this on production
  if (PUB_VITE_SUPABASE_URL.includes('supabase.co')) {
    throw new Error(
      'You are attempting to run seeds on a production database; revisit your env vars and try again.'
    );
  }

  const supabase = createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  });

  // get the LPC affiliate org
  const { data: affiliateOrg, error: supabaseError0 } = await supabase
    .from('affiliate_organizations')
    .select('*')
    .eq('name', 'LPC')
    .single();
  if (supabaseError0) throw supabaseError0;

  // make DU organizer user
  let organizerUserId: string | null = null;

  const { data: duOrganizerUser, error: signUpDuOrganizerUserError } = await supabase.auth.signUp({
    phone: '12223334444',
    // we assign a random password here because we will never need it
    password: 'secretcode'
  });

  if (signUpDuOrganizerUserError) {
    const {
      data: { users }
    } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = users.find((user) => user.phone === '12223334444');
    if (!existing) throw signUpDuOrganizerUserError;
    organizerUserId = existing.id;
    console.log('reusing existing organizer user:', organizerUserId);
  } else {
    if (duOrganizerUser === null) throw new Error('No user data returned from signup');
    if (duOrganizerUser.user === null) throw new Error('No user returned from signup');
    console.log('created user:', duOrganizerUser.user.id);
    organizerUserId = duOrganizerUser.user.id;
  }

  if (organizerUserId) {
    // affiliate with DU as lead organizer so the Team page is exercisable locally
    const { error: affiliationError } = await supabase.from('organization_members').upsert(
      [
        {
          user_id: organizerUserId,
          organization_id: affiliateOrg.id,
          role: 'lead_organizer'
        }
      ],
      { onConflict: 'user_id,organization_id' }
    );
    if (affiliationError) throw affiliationError;
    console.log('added organizer affiliation to', affiliateOrg.name);

    // add phone number to whitelist associated with DU
    const { error: whitelistError } = await supabase
      .from('organizer_affiliations_phone_whitelist')
      .upsert(
        [
          {
            phone_number: '12223334444',
            affiliate_organization_id: affiliateOrg.id
          }
        ],
        { onConflict: 'affiliate_organization_id,phone_number', ignoreDuplicates: true }
      );
    if (whitelistError) throw whitelistError;
    console.log('added phone to whitelist');

    // organizer user role (we only do this once per user, don't redo for affiliating with PELQ)
    const { error: userRoleError } = await supabase.from('user_roles').upsert(
      [
        {
          user_id: organizerUserId,
          role: 'organizer'
        }
      ],
      { onConflict: 'user_id' }
    );
    if (userRoleError) throw userRoleError;
    console.log('added organizer role to user');
  }

  // affiliate org with secret signup code
  const { data: lpcOrg, error: supabaseError1 } = await supabase
    .from('affiliate_organizations')
    .update({
      signup_code: 'secret'
    })
    .match({ id: affiliateOrg.id })
    .select('*')
    .single();
  if (supabaseError1) throw supabaseError1;
  console.log('got lpcOrg:', lpcOrg);

  // make this organizer also associated with PELQ

  // get the PELQ affiliate org
  const { data: pelqAffiliateOrg, error: pelqError0 } = await supabase
    .from('affiliate_organizations')
    .select('*')
    .eq('name', 'PELQ')
    .single();
  if (pelqError0) throw pelqError0;

  // affiliate with PELQ as a regular organizer
  const { error: affiliationError } = await supabase.from('organization_members').upsert(
    [
      {
        user_id: organizerUserId,
        organization_id: pelqAffiliateOrg.id,
        role: 'organizer'
      }
    ],
    { onConflict: 'user_id,organization_id' }
  );
  if (affiliationError) throw affiliationError;
  console.log('added organizer affiliation to', pelqAffiliateOrg.name);

  // make a row in the organizer_affiliations_phone_whitelist
  const { error: whitelistError } = await supabase
    .from('organizer_affiliations_phone_whitelist')
    .upsert(
      [
        {
          phone_number: '12223334444',
          affiliate_organization_id: pelqAffiliateOrg.id
        }
      ],
      { onConflict: 'affiliate_organization_id,phone_number', ignoreDuplicates: true }
    );
  if (whitelistError) throw whitelistError;
  console.log('added phone to whitelist');

  // PELQ affiliate org with secret2 signup code
  const { data: pelq, error: pelqError1 } = await supabase
    .from('affiliate_organizations')
    .update({
      signup_code: 'secret2'
    })
    .match({ id: pelqAffiliateOrg.id })
    .select('*')
    .single();
  if (pelqError1) throw pelqError1;
  console.log('got pelq:', pelq);

  const makeDriverUser = async (
    email: string,
    firstName: string,
    lastName: string,
    phone: string,
    affiliateOrganizationId: string,
    numActivities: number = 1_000
  ) => {
    const driverUser = await createOrAdoptUser(supabase, {
      email,
      password: SUPABASE_DEFAULT_PASSWORD
    });
    console.log('got driverSignupData:', driverUser.email);

    // example namespace
    const NAMESPACE = 'abc1234e-9dad-11d1-80b4-00c04fd430c8';

    function generateUUID(email: string, type: string) {
      return v3(`${type}_${email}`, NAMESPACE);
    }

    const argyleUserId = generateUUID(email, 'argyle_user');

    await updateProfileByUserId(supabase, driverUser.id, {
      first_name: firstName,
      last_initial: getLastInitialsFromLastName(lastName), // function utilized here
      phone: phone,
      email: email,
      argyle_user: argyleUserId
    });

    const argyleAccount = generateUUID(email, 'argyle_account');

    // make an an argyle_account row with this argyle_account
    const { data: existingAccount } = await supabase
      .from('argyle_accounts')
      .select('id')
      .eq('user_id', driverUser.id)
      .eq('argyle_account', argyleAccount)
      .maybeSingle();

    let argyleAccountData = existingAccount;
    if (!argyleAccountData) {
      const { data: createdAccount, error: createArgyleAccountError } = await supabase
        .from('argyle_accounts')
        .insert({
          user_id: driverUser.id,
          // hash the email into a fake argyle_user and argyle_account uuid
          argyle_user: argyleUserId,
          argyle_account: argyleAccount,
          all_gigs_last_synced_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (createArgyleAccountError) {
        console.error('Error creating argyle account:', createArgyleAccountError);
        throw createArgyleAccountError;
      }
      argyleAccountData = createdAccount;
    }
    console.log('Created argyle account:', argyleAccountData);

    const { error: supabaseError4 } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .upsert(
        [
          {
            user_id: driverUser.id,
            affiliate_organization_id: affiliateOrganizationId
          }
        ],
        { onConflict: 'user_id, affiliate_organization_id' }
      );
    if (supabaseError4) throw supabaseError4;
    console.log('added data sharing consent for driver');

    const { error: supabaseError9 } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .upsert(
        [
          {
            user_id: driverUser.id,
            affiliate_organization_id: affiliateOrganizationId,
            is_primary: true
          }
        ],
        { onConflict: 'user_id, affiliate_organization_id' }
      );
    if (supabaseError9) throw supabaseError9;
    console.log('added data sharing consent for driver');

    const { count: existingActivityCount } = await supabase
      .from('argyle_driver_activities')
      .select('id', { count: 'exact', head: true })
      .eq('user', driverUser.id);
    if (existingActivityCount && existingActivityCount >= numActivities) {
      console.log(`driver already has ${existingActivityCount} activities; skipping generation`);
      return;
    }

    console.log('generating driver activities. this may take a while...');

    const generateMockedDriverActivityRow = (
      overrideArguments: {
        user: string;
        account: string;
        account_id: string;
      },
      activityIndex: number
    ) => {
      // Use a deterministic seed based on the email and activity index
      const seed =
        email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + activityIndex;
      const random = new SeededRandom(seed);

      // Get a deterministic base date
      const millisecondsInAYear = 60 * 60 * 24 * 365 * 1000;
      const baseTime = new Date('2024-01-01').getTime();

      // Generate a random time within the year
      const activityTime = baseTime + random.next() * millisecondsInAYear;

      // Create start time within 2 hours before activity time
      const startTime = activityTime - random.next() * 2 * 60 * 60 * 1000;
      // Create end time up to 2 hours after start time
      const endTime = startTime + random.next() * 2 * 60 * 60 * 1000;
      // Created time is always after the activity
      const createdTime = endTime + random.next() * 60 * 60 * 1000;

      const activityId = v3(`${email}-${activityIndex}`, v3.URL);

      return {
        employer: random.next() < 0.7 ? 'uber' : 'doordash', // 70% Uber, 30% Lyft
        circumstances_is_pool: null,
        circumstances_is_rush: null,
        circumstances_is_surge: random.next() < 0.1 ? 'true' : 'false',
        circumstances_position: null,
        circumstances_service_type: null,
        created_at: new Date(createdTime).toISOString(),
        distance: (Math.floor(random.next() * 450 + 50) / 100).toFixed(2), // note that this is a string from Argyle, not a number
        distance_unit: 'miles',
        duration: Math.floor(random.next() * (30 - 3 + 1) * 60 + 3 * 60), // Between 3-30 minutes in seconds
        earning_type: null,
        start_datetime: new Date(startTime).toISOString(),
        end_datetime: new Date(endTime).toISOString(),
        end_location: Math.floor(random.next() * 100000),
        end_location_formatted_address:
          SAMPLE_ADDRESSES[Math.floor(random.next() * SAMPLE_ADDRESSES.length)],
        end_location_lat: (random.next() * 180 - 90).toFixed(6),
        end_location_lng: (random.next() * 360 - 180).toFixed(6),
        id: activityId,
        income_bonus: Math.floor(random.next() * 100),
        income_currency: 'USD',
        income_fees: Math.floor(random.next() * 100),
        income_other: Math.floor(random.next() * 100),
        income_pay: Math.floor(random.next() * 1000),
        income_rates_hour: Math.floor(random.next() * 50),
        income_rates_mile: Math.floor(random.next() * 10),
        income_tips: Math.floor(random.next() * 100),
        income_total: Math.floor(random.next() * 1000),
        income_total_charge: Math.floor(random.next() * 1000),
        metadata: null,
        metadata_circumstances_is_pool: false,
        metadata_circumstances_is_rush: null,
        metadata_circumstances_is_surge: false,
        metadata_circumstances_service_type: 'Uber',
        metadata_origin_id: null,
        start_location: Math.floor(random.next() * 100000),
        start_location_formatted_address:
          SAMPLE_ADDRESSES[Math.floor(random.next() * SAMPLE_ADDRESSES.length)],
        start_location_lat: (random.next() * 180 - 90).toFixed(6),
        start_location_lng: (random.next() * 360 - 180).toFixed(6),
        status: random.next() < 0.9 ? 'completed' : 'cancelled',
        task_count: null,
        timezone: random.next() < 0.5 ? 'America/New_York' : 'America/Los_Angeles',
        type: null,
        updated_at: new Date(createdTime).toISOString(),
        ...overrideArguments
      };
    };

    // do generateMockedDriverActivityRow numActivities into a list
    const driverActivities = Array.from({ length: numActivities }, (_, activityIndex) =>
      generateMockedDriverActivityRow(
        {
          user: driverUser.id,
          account: argyleAccount,
          account_id: argyleAccountData.id
        },
        activityIndex
      )
    );

    // Insert in batches of 1000 (large counts still exercise CSV / portal paths without CI timeouts)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < driverActivities.length; i += BATCH_SIZE) {
      const batch = driverActivities.slice(i, i + BATCH_SIZE);
      const { error: supabaseError5 } = await supabase
        .from('argyle_driver_activities')
        .insert(batch);
      if (supabaseError5) {
        console.error('Error inserting batch:', supabaseError5);
        console.error('First activity in batch:', batch[0]);
        throw supabaseError5;
      }
      console.log(
        `Inserted batch ${i / BATCH_SIZE + 1} of ${Math.ceil(driverActivities.length / BATCH_SIZE)}`
      );
    }
    console.log('Added all driver activities');
  };

  // helper for users who consented but did not successfully link their accounts
  const makeConsentOnlyUser = async (email: string, affiliateOrganizationId: string) => {
    const consentOnlyUser = await createOrAdoptUser(supabase, {
      email,
      password: SUPABASE_DEFAULT_PASSWORD
    });
    console.log('got consentOnlySignupData:', consentOnlyUser.email);

    const { error: consentError } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .upsert(
        [
          {
            user_id: consentOnlyUser.id,
            affiliate_organization_id: affiliateOrganizationId
          }
        ],
        { onConflict: 'user_id, affiliate_organization_id' }
      );
    if (consentError) throw consentError;

    const { error: affiliationError } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .upsert(
        [
          {
            user_id: consentOnlyUser.id,
            affiliate_organization_id: affiliateOrganizationId,
            is_primary: true
          }
        ],
        { onConflict: 'user_id, affiliate_organization_id' }
      );
    if (affiliationError) throw affiliationError;

    console.log('added consent-only affiliation for user');
  };

  // LPC drivers (with profiles and activities)
  await makeDriverUser(
    'new@getsystem.org',
    'First',
    'Last',
    '13032223333',
    lpcOrg.id,
    duHighVolumeActivityCount
  );

  // add the rest with default activitis count of 1000
  const duDrivers = [
    { email: 'du_driver1@getsystem.org', first: 'Casey', last: 'Driver', phone: '11019992222' },
    { email: 'another@getsystem.org', first: 'John', last: 'Smith', phone: '12029992222' },
    { email: 'additional@getsystem.org', first: 'Jane', last: 'Doe', phone: '14031112222' },
    { email: 'next@getsystem.org', first: 'Alice', last: 'Wonderland', phone: '15032223333' },
    { email: 'more@getsystem.org', first: 'Bob', last: 'Builder', phone: '16032223333' },
    { email: 'unique1@getsystem.org', first: 'Charlie', last: 'Brown', phone: '17032223333' },
    { email: 'unique2@getsystem.org', first: 'Lucy', last: 'VanPelt', phone: '18032223333' },
    { email: 'unique3@getsystem.org', first: 'Linus', last: 'VanPelt', phone: '19032223333' },
    { email: 'unique4@getsystem.org', first: 'Snoopy', last: 'Doghouse', phone: '11032223333' },
    { email: 'unique5@getsystem.org', first: 'Peppermint', last: 'Patty', phone: '10032223333' },
    { email: 'driver1@getsystem.org', first: 'Clark', last: 'Kent', phone: '12032223334' },
    { email: 'driver2@getsystem.org', first: 'Bruce', last: 'Wayne', phone: '13032223334' },
    { email: 'driver3@getsystem.org', first: 'Diana', last: 'Prince', phone: '14032223334' },
    { email: 'driver4@getsystem.org', first: 'Barry', last: 'Allen', phone: '15032223334' },
    { email: 'driver5@getsystem.org', first: 'Hal', last: 'Jordan', phone: '16032223334' },
    { email: 'driver6@getsystem.org', first: 'Arthur', last: 'Curry', phone: '17032223334' },
    { email: 'driver7@getsystem.org', first: 'Victor', last: 'Stone', phone: '18032223334' },
    { email: 'driver8@getsystem.org', first: 'Peter', last: 'Parker', phone: '19032223334' },
    { email: 'driver9@getsystem.org', first: 'Tony', last: 'Stark', phone: '10032223334' },
    { email: 'driver10@getsystem.org', first: 'Steve', last: 'Rogers', phone: '11032223334' },
    { email: 'user1@getsystem.org', first: 'Natasha', last: 'Romanoff', phone: '12032223335' },
    { email: 'user2@getsystem.org', first: 'Bruce', last: 'Banner', phone: '13032223335' },
    { email: 'user3@getsystem.org', first: 'Thor', last: 'Lastname', phone: '14032223335' }
  ];

  for (const d of duDrivers) {
    await makeDriverUser(d.email, d.first, d.last, d.phone, lpcOrg.id);
  }

  // LPC users who consented but did not successfully link their accounts
  const duConsentOnlyDrivers = [
    { email: 'du_unlinked1@getsystem.org' },
    { email: 'du_unlinked2@getsystem.org' },
    { email: 'du_unlinked3@getsystem.org' },
    { email: 'du_unlinked4@getsystem.org' }
  ];

  for (const d of duConsentOnlyDrivers) {
    await makeConsentOnlyUser(d.email, lpcOrg.id);
  }

  const pelqDrivers = [
    {
      email: 'pelq_driver1@getsystem.org',
      first: 'Frodo',
      last: 'Baggins',
      phone: '12125550001'
    },
    {
      email: 'pelq_driver2@getsystem.org',
      first: 'Samwise',
      last: 'Gamgee',
      phone: '12125550002'
    },
    {
      email: 'pelq_driver3@getsystem.org',
      first: 'Peregrin',
      last: 'Took',
      phone: '12125550003'
    },
    {
      email: 'pelq_driver4@getsystem.org',
      first: 'Meriadoc',
      last: 'Brandybuck',
      phone: '12125550004'
    },
    { email: 'pelq_driver5@getsystem.org', first: 'Gandalf', last: 'Grey', phone: '12125550005' },
    {
      email: 'pelq_driver6@getsystem.org',
      first: 'Boromir',
      last: 'Smith',
      phone: '12125550006'
    },
    { email: 'pelq_driver7@getsystem.org', first: 'Gimli', last: 'Gloin', phone: '12125550007' },
    {
      email: 'pelq_driver8@getsystem.org',
      first: 'Legolas',
      last: 'Woodland',
      phone: '12125550008'
    },
    {
      email: 'pelq_driver9@getsystem.org',
      first: 'Aragorn',
      last: 'Arathorn',
      phone: '12125550009'
    },
    {
      email: 'pelq_driver10@getsystem.org',
      first: 'Harry',
      last: 'Potter',
      phone: '12125550010'
    },
    { email: 'pelq_driver11@getsystem.org', first: 'Ron', last: 'Weasley', phone: '12125550011' },
    {
      email: 'pelq_driver12@getsystem.org',
      first: 'Hermione',
      last: 'Granger',
      phone: '12125550012'
    },
    {
      email: 'pelq_driver13@getsystem.org',
      first: 'Neville',
      last: 'Longbottom',
      phone: '12125550013'
    },
    {
      email: 'pelq_driver14@getsystem.org',
      first: 'Luna',
      last: 'Lovegood',
      phone: '12125550014'
    },
    {
      email: 'pelq_driver15@getsystem.org',
      first: 'Percy',
      last: 'Jackson',
      phone: '12125550015'
    },
    {
      email: 'pelq_driver16@getsystem.org',
      first: 'Annabeth',
      last: 'Chase',
      phone: '12125550016'
    },
    { email: 'pelq_driver17@getsystem.org', first: 'Leo', last: 'Valdez', phone: '12125550017' },
    {
      email: 'pelq_driver18@getsystem.org',
      first: 'Piper',
      last: 'McLean',
      phone: '12125550018'
    },
    {
      email: 'pelq_driver19@getsystem.org',
      first: 'Luke',
      last: 'Skywalker',
      phone: '12125550019'
    },
    {
      email: 'pelq_driver20@getsystem.org',
      first: 'Princess',
      last: 'Leia',
      phone: '12125550020'
    },
    { email: 'pelq_driver21@getsystem.org', first: 'Darth', last: 'Vader', phone: '12125550021' },
    { email: 'pelq_driver22@getsystem.org', first: 'Han', last: 'Solo', phone: '12125550022' },
    {
      email: 'pelq_driver23@getsystem.org',
      first: 'Thor',
      last: 'Lastname',
      phone: '12125550023'
    },
    {
      email: 'pelq_driver24@getsystem.org',
      first: 'Elrond',
      last: 'Stone',
      phone: '12125550024'
    },
    { email: 'pelq_driver25@getsystem.org', first: 'Arwen', last: 'Stone', phone: '12125550025' }
  ];
  // PELQ drivers (25 users with profiles and activities)
  for (const d of pelqDrivers) {
    await makeDriverUser(d.email, d.first, d.last, d.phone, pelq.id, 100);
  }

  // PELQ users who consented but did not successfully link their accounts
  const pelqConsentOnlyDrivers = [
    { email: 'pelq_unlinked1@getsystem.org' },
    { email: 'pelq_unlinked2@getsystem.org' },
    { email: 'pelq_unlinked3@getsystem.org' },
    { email: 'pelq_unlinked4@getsystem.org' }
  ];
  for (const d of pelqConsentOnlyDrivers) {
    await makeConsentOnlyUser(d.email, pelq.id);
  }

  // Refresh materialized views
  const { error } = await supabase.rpc('refresh_policy_analysis_views');
  if (error) {
    console.error('Error refreshing materialized views:', error.message);
  } else {
    console.log('Materialized views refreshed successfully');
  }
};
export default makeOrganizersSeeds;

// Self-invoke when run directly via `pnpm seed:organizers`
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('makeOrganizersSeeds.ts') ||
    process.argv[1].endsWith('makeOrganizersSeeds.js'));
if (isDirectRun) {
  makeOrganizersSeeds().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
