import { createClient } from '@supabase/supabase-js';

import type { SupabaseClient } from '@supabase/supabase-js';

// dotenv
import { config } from 'dotenv';
import { v3 } from 'uuid';
config();

const PUB_VITE_SUPABASE_URL = process.env.PUB_VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_DEFAULT_PASSWORD = process.env.SUPABASE_DEFAULT_PASSWORD;

export const updateProfileByUserId = async (
  supabase: SupabaseClient,
  userId: string,
  updateData: any
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

const makeOrganizersSeeds = async () => {
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

  // get the affiliate org id
  const { data: affiliateOrg, error: supabaseError0 } = await supabase
    .from('affiliate_organizations')
    .select('*')
    .eq('name', 'LPC')
    .single();
  if (supabaseError0) throw supabaseError0;

  // affiliate org with secret signup code
  const { data: lpc, error: supabaseError1 } = await supabase
    .from('affiliate_organizations')
    .update({
      signup_code: 'secret'
    })
    .match({ id: affiliateOrg.id })
    .select('*')
    .single();
  if (supabaseError1) throw supabaseError1;
  console.log('got lpc:', lpc);

  // organizer user
  const { data: firstUserSignupData, error: firstUserCreateError } =
    await supabase.auth.admin.createUser({
      email: 'orgperson@du.com',
      password: SUPABASE_DEFAULT_PASSWORD,
      email_confirm: true
    });
  if (firstUserCreateError) throw firstUserCreateError;
  console.log('got firstUserSignupData:', firstUserSignupData);

  // organizer user role
  const { error: supabaseError2 } = await supabase.from('user_roles').insert([
    {
      user_id: firstUserSignupData.user.id,
      role: 'organizer'
    }
  ]);
  if (supabaseError2) throw supabaseError2;
  console.log('added organizer role to user');

  const { error: supabaseError3 } = await supabase
    .from('organizer_affiliate_organization_affiliations')
    .insert([
      {
        user_id: firstUserSignupData.user.id,
        affiliate_organization_id: lpc.id
      }
    ]);
  if (supabaseError3) throw supabaseError3;
  console.log('added organizer affiliation with LPC');

  const makeDriverUser = async (
    email: string,
    firstName: string,
    lastName: string,
    phone: string
  ) => {
    const { data: driverSignupData, error: driverCreateError } =
      await supabase.auth.admin.createUser({
        email: email,
        password: SUPABASE_DEFAULT_PASSWORD,
        email_confirm: true
      });
    if (driverCreateError) throw driverCreateError;
    console.log('got driverSignupData:', driverSignupData);

    // example namespace
    const NAMESPACE = 'abc1234e-9dad-11d1-80b4-00c04fd430c8';

    function generateUUID(email: string, type: string) {
      return v3(`${type}_${email}`, NAMESPACE);
    }

    const argyleUserId = generateUUID(email, 'argyle_user');

    await updateProfileByUserId(supabase, driverSignupData.user.id, {
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      email: email,
      argyle_user: argyleUserId
    });

    const argyleAccount = generateUUID(email, 'argyle_account');

    // make an an argyle_account row with this argyle_account
    const { error: createArgyleAccountError } = await supabase.from('argyle_accounts').insert({
      user_id: driverSignupData.user.id,
      // hash the email into a fake argyle_user and argyle_account uuid
      argyle_user: argyleUserId,
      argyle_account: argyleAccount,
      all_gigs_last_synced_at: new Date().toISOString()
    });
    if (createArgyleAccountError) throw createArgyleAccountError;

    const { error: supabaseError4 } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .insert([
        {
          user_id: driverSignupData.user.id,
          affiliate_organization_id: lpc.id
        }
      ]);
    if (supabaseError4) throw supabaseError4;
    console.log('added data sharing consent for driver');

    const { error: supabaseError9 } = await supabase
      .from('driver_affiliate_organization_affiliations')
      .insert([
        {
          user_id: driverSignupData.user.id,
          affiliate_organization_id: lpc.id
        }
      ]);
    if (supabaseError9) throw supabaseError9;
    console.log('added data sharing consent for driver');

    const generateMockedDriverActivity = (overrideArguments = {}) => {
      // Get the date from a week ago
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Function to generate a random date within the last week
      const randomDateLastWeek = () => {
        const randomOffset = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
        return new Date(oneWeekAgo.getTime() + randomOffset);
      };

      return {
        account: '00000000-0000-0000-0000-000000000000',
        employer: Math.random() < 0.7 ? 'uber' : 'lyft', // 70% Uber, 30% Lyft
        circumstances_is_pool: null,
        circumstances_is_rush: null,
        circumstances_is_surge: null,
        circumstances_position: null,
        circumstances_service_type: null,
        created_at: randomDateLastWeek().toISOString(),
        distance: null,
        distance_unit: null,
        duration: null,
        earning_type: null,
        end_datetime: randomDateLastWeek().toISOString(),
        end_location: Math.floor(Math.random() * 100000),
        end_location_formatted_address: null,
        end_location_lat: (Math.random() * 180 - 90).toFixed(6),
        end_location_lng: (Math.random() * 360 - 180).toFixed(6),
        id: 'mocked_id' + Math.floor(Math.random() * 100000000000),
        income_bonus: Math.floor(Math.random() * 100),
        income_currency: 'USD',
        income_fees: Math.floor(Math.random() * 100),
        income_other: Math.floor(Math.random() * 100),
        income_pay: Math.floor(Math.random() * 1000),
        income_rates_hour: Math.floor(Math.random() * 50),
        income_rates_mile: Math.floor(Math.random() * 10),
        income_tips: Math.floor(Math.random() * 100),
        income_total: Math.floor(Math.random() * 1000),
        income_total_charge: Math.floor(Math.random() * 1000),
        metadata: null,
        metadata_circumstances_is_pool: null,
        metadata_circumstances_is_rush: null,
        metadata_circumstances_is_surge: null,
        metadata_circumstances_service_type: null,
        metadata_origin_id: null,
        start_datetime: randomDateLastWeek().toISOString(),
        start_location: Math.floor(Math.random() * 100000),
        start_location_formatted_address: null,
        start_location_lat: (Math.random() * 180 - 90).toFixed(6),
        start_location_lng: (Math.random() * 360 - 180).toFixed(6),
        status: null,
        task_count: null,
        timezone: null,
        type: null,
        updated_at: randomDateLastWeek().toISOString(),
        user: null,
        ...overrideArguments
      };
    };

    // do generateMockedDriverActivity 20x into a list
    const driverActivities = Array.from({ length: 100 }, () =>
      generateMockedDriverActivity({ user: driverSignupData.user.id, account: argyleAccount })
    );

    // insert 'em
    const { error: supabaseError5 } = await supabase
      .from('argyle_driver_activities')
      .insert(driverActivities);
    if (supabaseError5) throw supabaseError5;
    console.log('added driver activities');
  };

  await makeDriverUser('new@getsystem.org', 'First', 'Last', '13032223333');
  await makeDriverUser('another@getsystem.org', 'John', 'Smith', '12029992222');

  // make a row in the organizer_affiliations_phone_whitelist
  const { error: supabaseError6 } = await supabase
    .from('organizer_affiliations_phone_whitelist')
    .insert([
      {
        phone_number: '12223334444',
        affiliate_organization_id: lpc.id
      }
    ]);
  if (supabaseError6) throw supabaseError6;
  console.log('added phone to whitelist');
};

export default makeOrganizersSeeds;
