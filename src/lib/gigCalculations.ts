import short from 'short-uuid';
import _ from 'lodash';
import moment from 'moment';

import { supabase as serverSupabase } from '@src/lib/server/db';

import { getUserPhoneNumberFromId } from '@src/routes/api/auth/utils';

import type { SupabaseClient } from '@supabase/supabase-js';

type ArgyleDriverActivity = SupabaseRows['argyle_driver_activities'];

export interface ActivityWithTakeRate extends ArgyleDriverActivity {
  take_rate: number;
}

class UserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserNotFoundError'; // this is the i18n key
  }
}

class ActivitiesNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActivitiesNotFoundError'; // this is the i18n key
  }
}

class LessThanTenGigsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LessThanTenGigsError'; // this is the i18n key
  }
}

const getRecentSixMonthsOfGigsFromShortUserId = async (
  shortUserId: string,
  supabase: SupabaseClient
) => {
  /**
   * Gets the most recent six months of a user's gigs from the surveyId.
   *
   * @param shortUserId - The short user ID of the user's supabase user ID.
   * @returns The most recent six months of a user's gigs.
   */
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const translator = short();
  const userId = translator.toUUID(shortUserId);

  // get the user's argyle accounts
  const { data: argyleAccountData, error: argyleAccountError } = await supabase
    .from('argyle_accounts')
    .select('argyle_account')
    .eq('user_id', userId);

  if (argyleAccountData === null || argyleAccountError) {
    console.error('argyleAccountData:', argyleAccountData);
    console.error('userError:', argyleAccountError);
    throw new UserNotFoundError('Could not find user: ' + argyleAccountError?.message);
  }

  const accounts = argyleAccountData.map((p) => p.argyle_account);

  // all activities for this account
  const { data: activities, error } = await supabase
    .from('argyle_driver_activities')
    .select('*')
    .in('account', accounts)
    .gte('start_datetime', new Date(sixMonthsAgo).toISOString())
    .order('start_datetime', { ascending: false });

  if (activities === null || error) {
    throw new ActivitiesNotFoundError('Could not find activities: ' + error?.message);
  }

  return activities;
};

const getRecentSixMonthsPublicTakeRateInfoFromShortUserId = async (shortUserId: string) => {
  const gigs = await getRecentSixMonthsOfGigsFromShortUserId(shortUserId, serverSupabase);
  const filteredGigsWithNonNaNTakeRates = getFilteredGigsWithNonNaNTakeRates(
    gigs as ArgyleDriverActivity[]
  );
  return await _getPublicTakeRateInfoFromGigsWithTakeRates(filteredGigsWithNonNaNTakeRates);
};

const getFilteredGigsWithNonNaNTakeRates = (
  gigs: ArgyleDriverActivity[]
): ActivityWithTakeRate[] => {
  const computeTake = (activity: ArgyleDriverActivity) => {
    // take is calculated as (income_fees / (income_total_charge - income_tips))
    // income_total_charge = income_fees + income_total
    const income_fees = activity.income_fees!;
    const income_total_charge = activity.income_fees! + activity.income_total!;
    const income_tips = activity.income_tips!;

    const take = (income_fees / (income_total_charge - income_tips)) * 100;
    return take;
  };

  const gigsWithTakeRate = gigs.map((x) => ({
    ...x,
    take_rate: computeTake(x)
  }));

  const filteredGigsWithTakeRate = gigsWithTakeRate.filter(
    (x) =>
      x.income_fees !== null &&
      x.income_fees >= 0 &&
      x.income_total_charge !== null &&
      x.income_total_charge > 0 &&
      x.type === 'rideshare'
  );

  const filteredGigsWithNonNaNTakeRates = filteredGigsWithTakeRate.filter(
    (x) => !isNaN(x.take_rate)
  );

  return filteredGigsWithNonNaNTakeRates;
};

const _getPublicTakeRateInfoFromGigsWithTakeRates = async (gigs: ActivityWithTakeRate[]) => {
  /**
   * Here we compile the public take rate info that we'll pass from the server
   * to the client.
   *
   * We do this
   *  1. to avoid exposing all the gigs to anonymous users and
   *  2. to isolate the calculation logic to this file
   *
   * This follows a nice MVC pattern, where the client remains "dumb" and
   * only has a responsibility to display the data.
   *
   * @param gigs - The gigs to calculate the public take rate info from.
   */
  if (!checkIfGigsAreValid(gigs)) {
    throw new LessThanTenGigsError('Too few gigs');
  }

  const userId = gigs[0].user;

  if (!userId) throw new UserNotFoundError('No user id found');

  const phoneNumberLastTwo = await getUserPhoneNumberFromId(userId).then((x) => x?.slice(-2));

  const averagePlatformTakePct = _getAveragePlatformTakePctFromGigs(gigs);

  return {
    averagePlatformTakePctString: averagePlatformTakePct.toFixed(0),
    averagePlatformTakePct: averagePlatformTakePct,
    minPlatformTakeString: getMinPlatformTakeStringFromGigs(gigs),
    maxPlatformTakeString: getMaxPlatformTakeStringFromGigs(gigs),
    gigsLength: gigs.length,
    monthsSinceMinDateToShow: getMonthsSinceMinDateToShow(gigs),
    userId,
    phoneNumberLastTwo
  };
};

const checkIfGigsAreValid = (gigs: ActivityWithTakeRate[]) => {
  /**
   * Checks if the gigs are valid.
   *
   * @param gigs - The gigs to check.
   * @returns True if the gigs are valid, false otherwise.
   */
  if (gigs.length < 10) return false;

  // dc - removed 2/11/22
  // if the difference between the min and max dates is less than 1 month, then
  // we don't have enough data, so we return false
  // const minDateMoment = moment(getMinDateFromGigs(gigs));
  // const maxDateMoment = moment(getMaxDateFromGigs(gigs));
  // const differenceInMonths = maxDateMoment.diff(minDateMoment, 'months');
  // if (differenceInMonths < 1) return false;

  return true;
};

const _getAveragePlatformTakePctFromGigs = (gigs: ArgyleDriverActivity[]) => {
  const filteredGigsWithNonNaNTakeRates = getFilteredGigsWithNonNaNTakeRates(gigs);

  const averagePlatformTakePct = _.meanBy(filteredGigsWithNonNaNTakeRates, (x) => x.take_rate);

  return averagePlatformTakePct;
};

const getMinDateFromGigs = (gigs: ActivityWithTakeRate[]) => {
  if (gigs.length === 0) return null;
  const dates = gigs.map((x) => moment(x.start_datetime));
  return moment.min(dates).toISOString();
};

const getMinPlatformTakeStringFromGigs = (gigs: ActivityWithTakeRate[]) => {
  return _.min(gigs.map((x) => x.take_rate))?.toFixed(0);
};

const getMaxPlatformTakeStringFromGigs = (gigs: ActivityWithTakeRate[]) => {
  return _.max(gigs.map((x) => x.take_rate))?.toFixed(0);
};

const getMonthsSinceMinDateToShow = (gigs: ActivityWithTakeRate[]) => {
  /**
   * This returns the number of months since the minDate, or 6,
   * whichever is smaller.
   */

  const minDate = getMinDateFromGigs(gigs);
  const now = moment();

  const monthsSinceMinDate = now.diff(moment(minDate), 'months');

  if (monthsSinceMinDate >= 6) return 6;

  // if the minDate is 0, i.e., all of the data is from the most recent 30
  // days, then we want to return 1.
  if (monthsSinceMinDate < 1) return 1;

  return monthsSinceMinDate;
};

export {
  getRecentSixMonthsPublicTakeRateInfoFromShortUserId,
  _getAveragePlatformTakePctFromGigs,
  _getPublicTakeRateInfoFromGigsWithTakeRates
};
