import { supabase } from '@src/lib/server/db';
import { AsyncParser } from '@json2csv/node';
import { fetchIdentityByUser, saveAllArgyleDriverActivitiesToDb } from '@src/lib/server/argyle';

import type { RequestEvent } from './$types';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';

export const GET = async (request: RequestEvent) => {
  const { user } = await request.locals.safeGetSession();
  if (!user) throw new Error('No user found');

  const profile = await getProfileFromUserId(supabase, user.id);

  // TODO: support multiple accounts
  const { data: argyleAccountData, error: argyleAccountError } = await supabase
    .from('argyle_accounts')
    .select('argyle_account')
    .eq('user_id', user.id);

  if (argyleAccountError) throw new Error(argyleAccountError.message);

  const { argyle_account: argyleAccount } = argyleAccountData[0];

  if (!argyleAccount) return new Response('No argyle account found', { status: 404 });
  if (!profile.argyle_user) return new Response('No argyle user id found', { status: 404 });

  // Here we update the database by getting all of the activities from Argyle
  // TODO: stop doing this! We update nightly now
  const identities = await fetchIdentityByUser(profile.argyle_user);
  const argyleIdentity = identities[0];

  await saveAllArgyleDriverActivitiesToDb(argyleIdentity, argyleAccount);

  const { data, error } = await supabase
    .from('argyle_driver_activities')
    .select('*')
    .eq('account', argyleAccount);

  if (error) throw new Error("Couldn't find activities: " + error.message);

  // we need this because the parser will only accept keys in quotes
  const dataAsPojo = JSON.parse(JSON.stringify(data));

  const parser = new AsyncParser({
    fields: [
      'id',
      'account',
      'employer',
      'status',
      'type',
      'duration',
      'timezone',
      'earning_type',
      'start_location_lat',
      'start_location_lng',
      'start_location_formatted_address',
      'end_location_lat',
      'end_location_lng',
      'end_location_formatted_address',
      'distance',
      'distance_unit',
      'circumstances_is_pool',
      'circumstances_is_rush',
      'circumstances_is_surge',
      'circumstances_service_type',
      'income_currency',
      'income_total_charge',
      'income_fees',
      'income_total',
      'income_pay',
      'income_tips',
      'income_bonus',
      'income_rates_hour',
      'income_rates_mile',
      'end_datetime',
      'start_datetime',
      'task_count',
      'income_other'
    ]
  });
  const csv = await parser.parse(dataAsPojo).promise();

  return new Response(csv, { headers: { 'Content-Type': 'text/csv' } });
};
