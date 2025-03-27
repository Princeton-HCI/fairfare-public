import moment from 'moment';

import {
  _getAveragePlatformTakePctFromGigs,
  _getPublicTakeRateInfoFromGigsWithTakeRates
} from '@src/lib/gigCalculations';

import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import { supabase } from '@src/lib/server/db';

import cleanGigs from './cleanGigs.json';

import type { ActivityWithTakeRate } from '@src/lib/gigCalculations';
import { updateProfileByUserId } from './databaseHelpers';

type ArgyleDriverActivity = SupabaseRows['argyle_driver_activities'];

describe('gigCalculations', () => {
  describe('_getAveragePlatformTakePctFromGigs', () => {
    it('returns the average platform take percentage as a string', () => {
      const averagePlatformTakePct = _getAveragePlatformTakePctFromGigs(
        cleanGigs as ArgyleDriverActivity[]
      );
      expect(averagePlatformTakePct.toFixed(4)).toEqual('54.1138');
    });
  });

  describe('_getPublicTakeRateInfoFromGigsWithTakeRates', () => {
    describe('when there are normal gigs', () => {
      it('returns the expected values', async () => {
        const user = await createTestUserByEmail(
          'getpublictakerateinfofromgigswithtakeratesreturnsexpected@test.test'
        );

        await updateProfileByUserId(supabase, user.id, { phone: '12022222222' });

        const minimumSetOfGigs = [
          {
            id: '1',
            start_datetime: '2022-12-12T03:12:39Z',
            take_rate: 20,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '2',
            start_datetime: '2023-03-01T02:24:41Z',
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '3',
            start_datetime: '2023-04-01T02:24:41Z',
            take_rate: 60,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '4',
            start_datetime: '2024-01-01T02:24:41Z',
            take_rate: 50,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '5',
            start_datetime: '2024-01-01T02:24:41Z',
            take_rate: 50,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '6',
            start_datetime: '2024-01-01T02:24:41Z',
            take_rate: 50,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '7',
            start_datetime: '2024-01-01T02:24:41Z',
            take_rate: 50,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '8',
            start_datetime: '2024-01-01T02:24:41Z',
            take_rate: 50,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '9',
            start_datetime: '2024-01-01T02:24:41Z',
            take_rate: 50,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '10',
            start_datetime: '2024-01-01T02:24:41Z',
            take_rate: 50,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '11',
            start_datetime: '2024-01-01T02:24:41Z',
            take_rate: 50,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          }
        ] as ActivityWithTakeRate[];

        const publicTakeRateInfo =
          await _getPublicTakeRateInfoFromGigsWithTakeRates(minimumSetOfGigs);

        await teardownTestUserByUserId(user.id);

        expect(publicTakeRateInfo).toEqual({
          averagePlatformTakePct: 37.5,
          averagePlatformTakePctString: '38',
          minPlatformTakeString: '20',
          maxPlatformTakeString: '70',
          gigsLength: 11,
          monthsSinceMinDateToShow: 6,
          userId: user.id,
          phoneNumberLastTwo: '22'
        });
      });
    });
    describe('when there are less than 10 gigs', () => {
      const gigs = [
        {
          id: '1',
          start_datetime: '2022-12-12T03:12:39Z',
          take_rate: 20,
          income_fees: 12,
          income_total: 40,
          income_tips: 20,
          type: 'rideshare',
          income_total_charge: 120
        },
        {
          id: '2',
          start_datetime: '2023-03-01T02:24:41Z',
          take_rate: 70,
          income_fees: 12,
          income_total: 40,
          income_tips: 20,
          type: 'rideshare',
          income_total_charge: 120
        },
        {
          id: '3',
          start_datetime: '2023-04-01T02:24:41Z',
          take_rate: 60,
          income_fees: 12,
          income_total: 40,
          income_tips: 20,
          type: 'rideshare',
          income_total_charge: 120
        }
      ] as ActivityWithTakeRate[];
      it('is invalid and returns an error', async () => {
        await expect(_getPublicTakeRateInfoFromGigsWithTakeRates(gigs)).rejects.toThrow(
          'Too few gigs'
        );
      });
    });

    describe('when all activities are three months old or fewer', () => {
      it('monthsSinceMinDateToShow = 3', async () => {
        const threeMonthsOneWeekAgo = moment()
          .subtract(3, 'month')
          .subtract(1, 'week')
          .toISOString();
        const today = moment().toISOString();

        const user = await createTestUserByEmail('monthsSinceMinDateToShowIs3@test.test');

        const gigs = [
          {
            id: '1',
            start_datetime: today,
            take_rate: 20,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '2',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '3',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '4',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '5',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '6',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '7',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '8',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '9',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '10',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          },
          {
            id: '11',
            start_datetime: threeMonthsOneWeekAgo,
            take_rate: 70,
            income_fees: 12,
            income_total: 40,
            income_tips: 20,
            type: 'rideshare',
            income_total_charge: 120,
            user: user.id
          }
        ] as ActivityWithTakeRate[];

        const publicTakeRateInfo = await _getPublicTakeRateInfoFromGigsWithTakeRates(gigs);
        expect(publicTakeRateInfo.monthsSinceMinDateToShow).toEqual(3);

        await teardownTestUserByUserId(user.id);
      });
    });
  });
});
