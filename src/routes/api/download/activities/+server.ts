import { supabase } from '@src/lib/server/db';
import { AsyncParser } from '@json2csv/node';
import type { RequestEvent } from './$types';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';

export const GET = async (request: RequestEvent) => {
  const { user } = await request.locals.safeGetSession();
  if (!user) throw new Error('No user found');
  const profile = await getProfileFromUserId(supabase, user.id);

  const { data: argyleAccountData, error: argyleAccountError } = await supabase
    .from('argyle_accounts')
    .select('argyle_account')
    .eq('user_id', user.id);
  if (argyleAccountError) throw new Error(argyleAccountError.message);

  const argyleAccounts = argyleAccountData.map((account) => account.argyle_account);
  if (argyleAccounts.length === 0) return new Response('No argyle account found', { status: 404 });
  if (!profile.argyle_user) return new Response('No argyle user id found', { status: 404 });

  const { data, error } = await supabase
    .from('argyle_driver_activities')
    .select('*')
    .in('account', argyleAccounts);

  if (error) throw new Error("Couldn't find activities: " + error.message);

  const dataAsPojo = JSON.parse(JSON.stringify(data));

  // TODO: make this more efficient (see the download_driver_data_zip endpoint)
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
