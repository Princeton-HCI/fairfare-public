import { expect, type Locator, type Page } from '@playwright/test';
import _ from 'lodash';
import fetch from 'node-fetch';
import moment from 'moment';

export interface CompletedCard {
  locator: Locator;
  // totalIncome: string;
  orderPay?: string;
  // tips: string;
  // bonus: string;
  riderFare: string | undefined;
  activityTimes: string;
  activityStartDate: moment.Moment;
  activityEndDate: moment.Moment;
  status: 'completed';
}

export interface CancelledCard {
  locator: Locator;
  activityTimes: string;
  status: 'cancelled';
}

export type ActivityCard = CompletedCard | CancelledCard;

export const isCompletedCard = (card: ActivityCard): card is CompletedCard => {
  if (card.status === 'completed') {
    return true;
  }
  return false;
};

export const getLinkedActivities = async (driverPage: Page) => {
  const allActivities = await getActivities(driverPage, { linked: 'linked', status: 'completed' });
  const allActivityDetails = await Promise.all(
    allActivities.map(async (a) => (await getActivityCardDetails(a)) as CompletedCard)
  );

  // TODO: attempt to get the nearest date header of the activity card
  // let closestDateHeader = await latestActivity
  // 	.locator('xpath=ancestor::*[contains(@aria-label, "Fare Date Header")]')
  // 	.last()
  // 	.innerText();
  // console.log('activity start time: ', activityDetails.activityStartDate.format('HH:MM'));
  // console.log('CLOSEST date header to activity start time: ', closestDateHeader);

  return allActivityDetails;
};

const getCompletedActivities = async (activityCardLocators: Locator[]) => {
  const completedCardIndices = await Promise.all(
    activityCardLocators.map(async (activity) => {
      const activityStatus = activity.getByLabel('Activity Status');
      const statuses = await activityStatus.allTextContents();
      return !_.includes(statuses, 'cancelled');
    })
  );
  return activityCardLocators.filter((a, i) => completedCardIndices[i]);
};

const getCancelledActivities = async (activityCardLocators: Locator[]) => {
  const completedCardIndices = await Promise.all(
    activityCardLocators.map(async (activity) => {
      const activityStatus = activity.getByLabel('Activity Status');
      const statuses = await activityStatus.allTextContents();
      return _.includes(statuses, 'cancelled');
    })
  );
  return activityCardLocators.filter((a, i) => completedCardIndices[i]);
};

export const getActivities = async (
  driverPage: Page,
  {
    linked = 'all',
    status = 'all'
  }: {
    linked: 'all' | 'linked' | 'unlinked';
    status: 'all' | 'completed' | 'cancelled';
  }
) => {
  await driverPage.goto('/driver');
  const idString =
    linked === 'all'
      ? 'Activity Card'
      : linked === 'linked'
        ? 'Linked Activity Card'
        : 'Unlinked Activity Card';
  const allActivities = await driverPage
    .getByLabel(idString, { exact: linked === 'all' ? false : true })
    .all();
  console.log(`Found ${allActivities.length} activities`);

  if (status === 'completed') {
    return await getCompletedActivities(allActivities);
  } else if (status === 'cancelled') {
    return await getCancelledActivities(allActivities);
  } else {
    return allActivities;
  }
};

export const getLatestUnlinkedActivity = async (driverPage: Page): Promise<ActivityCard> => {
  await driverPage.goto('/driver');
  const allActivities = getActivities(driverPage, { linked: 'unlinked', status: 'all' });
  const latestActivity = (await allActivities)[0];
  // return visibleCompletedActivities.length > 0 ? date : null;
  const activityDetails = await getActivityCardDetails(latestActivity);
  return activityDetails as ActivityCard;
};

export const getLatestCompleteUnlinkedActivity = async (
  driverPage: Page
): Promise<CompletedCard> => {
  await driverPage.goto('/driver');
  const allActivities = getActivities(driverPage, { linked: 'unlinked', status: 'completed' });
  const latestActivity = (await allActivities)[0];
  // return visibleCompletedActivities.length > 0 ? date : null;
  const activityDetails = await getActivityCardDetails(latestActivity);
  return activityDetails as CompletedCard;
};

export const getLatestCompletedActivity = async (driverPage: Page) => {
  await driverPage.goto('/driver');
  const allActivities = getActivities(driverPage, { linked: 'all', status: 'completed' });
  const latestActivity = (await allActivities)[0];
  // return visibleCompletedActivities.length > 0 ? date : null;
  const activityDetails = (await getActivityCardDetails(latestActivity)) as CompletedCard;
  return activityDetails;
};

export const getFirstArgyleAccountId = async (driverPage: Page) => {
  await driverPage.goto('/settings');
  const accountId = await driverPage.getByLabel('argyle-id').innerText();
  return accountId;
};

export const getActivityCardDetails = async (
  activity: Locator, // locator for activity card
  dateHeader?: string // header of the section from card
): Promise<ActivityCard> => {
  const getDetail = async (l: Locator, label: string) => {
    return l.getByLabel(label).first().textContent();
  };

  const hasStatus = await activity!.getByLabel('Activity Status').isVisible({ timeout: 1000 });
  const status: 'complete' | 'cancelled' = hasStatus ? 'cancelled' : 'complete';
  // let completedActivityPay = await getDetail(activity!, 'Total income');
  const orderPayText = await getDetail(activity!, 'Order pay');
  const orderPay = orderPayText?.replace('$', '');
  // let tips = await getDetail(activity!, 'Tips');
  // let bonus = await getDetail(activity!, 'Bonus');
  const hasRiderFare = await activity.getByLabel('Rider Fare').isVisible();
  const riderFare = hasRiderFare ? await getDetail(activity!, 'Rider Fare') : undefined;

  if (status == 'cancelled') {
    const activityTimes = await getDetail(activity!, 'Cancelled Time');
    return {
      locator: activity!,
      status: 'cancelled',
      activityTimes
    } as CancelledCard;
  }
  const activityTimeText = await getDetail(activity!, 'Start Time and End Time');
  const activityTimes = activityTimeText?.replace(/[\r\n\t]/g, '');

  // some have a comma to include the day/date
  const startText = activityTimes?.split('-')[0];
  const endText = activityTimes?.split('-')[1];

  let activityStartDate: moment.Moment;
  let activityEndDate: moment.Moment;

  try {
    activityStartDate = moment(startText, 'MMM D LT');
    if (!activityStartDate.isValid()) {
      throw new Error('not a valid date');
    }
  } catch (_) {
    // it's not a date, so it's just a time
    activityStartDate = dateHeader ? moment(dateHeader, 'MMM D') : moment();
    const startTime = moment(startText, 'LT');
    activityStartDate.set('hour', startTime.get('hour'));
    activityStartDate.set('minutes', startTime.get('minutes'));
    console.log('Parsed start date:', activityStartDate.format('MMM D LT'));
  }

  const endTime = moment(endText, 'LT');
  activityEndDate = dateHeader ? moment(dateHeader, 'MMM D') : moment();
  activityEndDate.set('hour', endTime.get('hour'));
  activityEndDate.set('minutes', endTime.get('minutes'));

  console.log(
    `activity times: ${activityStartDate.format('MMM D LT')} - ${activityEndDate.format(
      'MMM D LT'
    )}`
  );

  return {
    locator: activity!,
    // totalIncome,
    orderPay,
    // tips,
    // bonus,
    activityTimes,
    riderFare,
    // full date if present, otherwise just time.
    activityStartDate: activityStartDate || moment(startText, 'LT'),
    activityEndDate: activityEndDate || moment(endText, 'LT')
  } as CompletedCard;
};

export const getRandomCompletedActivity = async (driverPage: Page) => {
  await driverPage.goto('/driver');
  expect(driverPage.getByLabel('more synced fares')).toBeVisible();
  const dateSections = await driverPage.getByLabel('day list').all();
  console.log('date sections:', dateSections);
  const datesWithCompletedIndices = dateSections.map(async (ds) => {
    const activities = await ds.getByLabel('Unlinked Activity Card').all();
    const completedActivities = await getCompletedActivities(activities);
    return completedActivities.length > 0;
  });
  const datesIdx: boolean[] = await Promise.all(datesWithCompletedIndices);
  // all date sections with a visible completed activity.
  const datesWithCompletedActivities = dateSections.filter((d, i) => datesIdx[i]);

  if (datesWithCompletedActivities.length === 0 || !datesWithCompletedActivities) {
    throw new Error('No days with completed activities found');
  }

  // get all visible activities under days with completed activities
  const randomDate = _.sample(datesWithCompletedActivities);
  const activities = await randomDate!.getByLabel('Activity Card').all();

  // filter out activities that are not completed (can't use async with filter)
  const completedActivities = await getCompletedActivities(activities);
  console.log(`Found ${completedActivities.length} completed activities, picking one at random...`);

  if (completedActivities.length === 0) {
    console.log('no completed activities found');
    return;
    // throw new Error('No completed activities found');
  }

  // get first completed activity (not cancelled, has a start and end time)
  // let firstCompletedActivity = datesWithCompletedActivities.getByLabel('Activity Card').first();
  // get a random completed activity
  console.log('Found a total of ' + completedActivities.length + ' completed activities.');
  let okExample = false;
  let completedActivity: Locator | undefined;
  while (!okExample) {
    completedActivity = _.sample(completedActivities);
    expect(completedActivity == undefined).not.toBeTruthy();
    const details = (await getActivityCardDetails(
      completedActivity!,
      await randomDate!.innerText()
    )) as CompletedCard;
    const activityDuration = Math.abs(
      details.activityEndDate.diff(details.activityStartDate, 'seconds')
    );
    okExample = activityDuration > 1;
  }

  return getActivityCardDetails(completedActivity!, await randomDate!.innerText());
};

export const requestPartialScan = async ({
  accountId,
  authString
}: {
  accountId: string;
  authString: string;
}) => {
  // console.log('starting partial sync for test account ', accountId, ' ...');
  // trigger partial sync
  // ('https://api-sandbox.argyle.com/v1/accounts/<acc-id>/periodic-scan');
  let scanResult: number | null = null;
  console.log('requesting periodic scan for sandbox account', accountId);
  while (scanResult !== 201) {
    const periodicScanResult = await fetch(
      `https://api-sandbox.argyle.com/v1/accounts/${accountId}/periodic-scan`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          authorization: `Basic ${authString}`
        }
      }
    );
    scanResult = periodicScanResult.status;
    if (scanResult !== 201) {
      console.log('Scan failed, retrying...');
      setTimeout(() => {}, 1000);
    }
  }

  // console.log('periodic scan result: ', periodicScanResult);
  expect(scanResult).toBe(201);
  console.log('Scanned! ');
};
