/**
 * Creates mock driver users and activities for the demo organizations (nstlte, plc, aass).
 * Run after `npx supabase db reset` to populate the organizer demo with member data.
 *
 * Usage: pnpm seed:demo-organizers
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLastInitialsFromLastName } from '../src/lib/nameUtils.js';
import { loadDemoArgyleActivities } from '../src/lib/server/demoData.js';
import { config } from 'dotenv';
import { v3 } from 'uuid';

config();

const PUB_VITE_SUPABASE_URL = process.env.PUB_VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_DEFAULT_PASSWORD = process.env.SUPABASE_DEFAULT_PASSWORD;

const DEMO_ORG_KEYS = ['nstlte', 'plc', 'aass'] as const;

const updateProfileByUserId = async (
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

const makeDemoDriverUser = async (
  supabase: SupabaseClient,
  orgKey: string,
  orgId: string,
  driverIndex: number
) => {
  const email = `demo-${orgKey}-driver${driverIndex}@demo.system.local`;
  const firstName = ['Alex', 'Jordan', 'Morgan', 'Riley', 'Casey'][driverIndex % 5];
  const lastName = ['Smith', 'Jones', 'Williams', 'Brown', 'Davis'][driverIndex % 5];
  const orgIndex = DEMO_ORG_KEYS.indexOf(orgKey);
  const phone = `1555555${String(orgIndex * 100 + driverIndex).padStart(3, '0')}`;

  const { data: driverSignupData, error: driverCreateError } = await supabase.auth.admin.createUser(
    {
      email,
      password: SUPABASE_DEFAULT_PASSWORD!,
      email_confirm: true
    }
  );

  if (driverCreateError) {
    console.error(`Error creating demo driver ${email}:`, driverCreateError);
    throw driverCreateError;
  }

  const NAMESPACE = 'abc1234e-9dad-11d1-80b4-00c04fd430c8';
  const argyleUserId = v3(`argyle_${email}`, NAMESPACE);
  const argyleAccount = v3(`account_${email}`, NAMESPACE);

  await updateProfileByUserId(supabase, driverSignupData.user!.id, {
    first_name: firstName,
    last_initial: getLastInitialsFromLastName(lastName),
    phone,
    email,
    argyle_user: argyleUserId
  });

  const { data: argyleAccountData, error: createArgyleAccountError } = await supabase
    .from('argyle_accounts')
    .insert({
      user_id: driverSignupData.user!.id,
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

  await supabase.from('driver_affiliate_organization_data_sharing_consents').insert({
    user_id: driverSignupData.user!.id,
    affiliate_organization_id: orgId
  });

  await supabase.from('driver_affiliate_organization_affiliations').insert({
    user_id: driverSignupData.user!.id,
    affiliate_organization_id: orgId,
    is_primary: true
  });

  const activities = loadDemoArgyleActivities(
    driverSignupData.user!.id,
    argyleAccount,
    argyleAccountData!.id
  );

  const { error: activitiesError } = await supabase
    .from('argyle_driver_activities')
    .insert(activities);

  if (activitiesError) {
    console.error('Error inserting activities:', activitiesError);
    throw activitiesError;
  }

  console.log(
    `Created demo driver ${firstName} ${lastName} for ${orgKey} with ${activities.length} activities`
  );
};

const makeDemoOrganizerSeeds = async () => {
  if (!PUB_VITE_SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_DEFAULT_PASSWORD) {
    throw new Error(
      'Environment variables PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_DEFAULT_PASSWORD must be set.'
    );
  }

  if (PUB_VITE_SUPABASE_URL.includes('supabase.co')) {
    throw new Error(
      'You are attempting to run demo seeds on a production database; revisit your env vars and try again.'
    );
  }

  const supabase = createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  });

  for (const orgKey of DEMO_ORG_KEYS) {
    const { data: org, error: orgError } = await supabase
      .from('affiliate_organizations')
      .select('id')
      .eq('key', orgKey)
      .single();

    if (orgError || !org) {
      console.error(`Demo org ${orgKey} not found. Run 'npx supabase db reset' first.`);
      throw orgError ?? new Error(`Organization ${orgKey} not found`);
    }

    for (let i = 0; i < 4; i++) {
      await makeDemoDriverUser(supabase, orgKey, org.id, i);
    }
  }

  console.log('Demo organizer seeds complete. 4 mock drivers per org (nstlte, plc, aass).');
};

makeDemoOrganizerSeeds().catch((err) => {
  console.error(err);
  process.exit(1);
});
