import moment from 'moment';

import {
  _getAveragePlatformTakePctFromGigs,
  _getPublicTakeRateInfoFromGigsWithTakeRates
} from '@src/lib/gigCalculations';

import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail,
  uniqueTestPhone
} from '@tests/utils/testUser';
import { supabase } from '@src/lib/server/db';

import cleanGigs from './cleanGigs.json';

import type { ActivityWithTakeRate } from '@src/lib/gigCalculations';
import { updateProfileByUserId } from './databaseHelpers';

type ArgyleDriverActivity = SupabaseRows['argyle_driver_activities'];

// `cleanGigs.json` predates per-platform support and has no `employer` field.
// All entries were sampled from a real Uber Driver account, so we tag them
// before exercising the calc (which now filters to SUPPORTED_TAKE_RATE_EMPLOYERS).
const uberCleanGigs = (cleanGigs as ArgyleDriverActivity[]).map((g) => ({
  ...g,
  employer: 'Uber Driver'
}));

describe('gigCalculations', () => {
  describe('_getAveragePlatformTakePctFromGigs', () => {
    it('returns the average platform take percentage as a string', () => {
      const averagePlatformTakePct = _getAveragePlatformTakePctFromGigs(uberCleanGigs);
      expect(averagePlatformTakePct.toFixed(4)).toEqual('54.1138');
    });

    it('ignores gigs from unsupported employers (e.g. Lyft)', () => {
      const lyftGigs = uberCleanGigs.map((g) => ({ ...g, employer: 'Lyft Driver' }));
      const averagePlatformTakePct = _getAveragePlatformTakePctFromGigs(lyftGigs);
      // mean of empty list is NaN
      expect(Number.isNaN(averagePlatformTakePct)).toBe(true);
    });
  });

  describe('_getPublicTakeRateInfoFromGigsWithTakeRates', () => {
    describe('when there are normal gigs', () => {
      it('returns the expected values', async () => {
        const user = await createTestUserByEmail(
          uniqueTestEmail('getpublictakerateinfofromgigswithtakeratesreturnsexpected')
        );

        const userPhone = uniqueTestPhone();
        await updateProfileByUserId(supabase, user.id, { phone: userPhone });

        const baseGig = (id: string, take_rate: number, employer = 'Uber Driver') => ({
          id,
          start_datetime: '2024-01-01T02:24:41Z',
          take_rate,
          income_fees: 12,
          income_total: 40,
          income_tips: 20,
          type: 'rideshare',
          income_total_charge: 120,
          user: user.id,
          employer
        });

        const minimumSetOfGigs = [
          { ...baseGig('1', 20), start_datetime: '2022-12-12T03:12:39Z' },
          { ...baseGig('2', 70), start_datetime: '2023-03-01T02:24:41Z' },
          { ...baseGig('3', 60), start_datetime: '2023-04-01T02:24:41Z' },
          baseGig('4', 50),
          baseGig('5', 50),
          baseGig('6', 50),
          baseGig('7', 50),
          baseGig('8', 50),
          baseGig('9', 50),
          baseGig('10', 50),
          baseGig('11', 50)
        ] as ActivityWithTakeRate[];

        const publicTakeRateInfo =
          await _getPublicTakeRateInfoFromGigsWithTakeRates(minimumSetOfGigs);

        await teardownTestUserByUserId(user.id);

        // Note: with the new shape, average / min / max all derive from the
        // `take_rate` field on each gig. The fixture take_rate values are
        // [20, 70, 60, 50×8] → mean 50. (Previously the old function
        // re-derived the average from raw fee/charge fields and produced
        // 37.5 while min/max read the take_rate field — those two were
        // inconsistent. The new code is internally consistent.)
        expect(publicTakeRateInfo).toEqual({
          aggregate: {
            averagePlatformTakePct: 50,
            averagePlatformTakePctString: '50',
            minPlatformTakeString: '20',
            maxPlatformTakeString: '70',
            gigsLength: 11
          },
          byPlatform: [
            {
              employer: 'Uber Driver',
              averagePlatformTakePct: 50,
              averagePlatformTakePctString: '50',
              minPlatformTakeString: '20',
              maxPlatformTakeString: '70',
              gigsLength: 11
            }
          ],
          unsupportedEmployers: [],
          monthsSinceMinDateToShow: 6,
          userId: user.id,
          phoneNumberLastTwo: userPhone.slice(-2)
        });
      });

      it('excludes Lyft gigs from the take rate calc and surfaces them as unsupported', async () => {
        const user = await createTestUserByEmail(
          uniqueTestEmail('getpublictakerateinfo-mixed-uber-lyft')
        );
        const userPhone = uniqueTestPhone();
        await updateProfileByUserId(supabase, user.id, { phone: userPhone });

        const baseGig = (id: string, take_rate: number, employer: string) => ({
          id,
          start_datetime: '2024-01-01T02:24:41Z',
          take_rate,
          income_fees: 12,
          income_total: 40,
          income_tips: 20,
          type: 'rideshare',
          income_total_charge: 120,
          user: user.id,
          employer
        });

        const gigs = [
          ...Array.from({ length: 11 }, (_v, i) => baseGig(`u${i}`, 40, 'Uber Driver')),
          // Lyft gigs report take_rate: 0 (their fees are always 0). If they
          // leaked into the average it would drag it well below 40.
          ...Array.from({ length: 5 }, (_v, i) => baseGig(`l${i}`, 0, 'Lyft Driver'))
        ] as ActivityWithTakeRate[];

        const info = await _getPublicTakeRateInfoFromGigsWithTakeRates(gigs);
        await teardownTestUserByUserId(user.id);

        expect(info.aggregate.averagePlatformTakePct).toEqual(40);
        expect(info.aggregate.gigsLength).toEqual(11);
        expect(info.byPlatform).toHaveLength(1);
        expect(info.byPlatform[0].employer).toEqual('Uber Driver');
        expect(info.unsupportedEmployers).toEqual(['Lyft Driver']);
      });

      it('canonicalises Argyle employer casing variants when grouping platforms', async () => {
        // Argyle is inconsistent: the same Uber account can come back as
        // "Uber Driver" on one row and "uber" on another, and Lyft shows up as
        // "lyft" lowercase. Without canonicalisation the lowercase rows leak
        // into `unsupportedEmployers` and the per-platform totals undercount.
        const user = await createTestUserByEmail(
          uniqueTestEmail('getpublictakerateinfo-employer-casing')
        );
        const userPhone = uniqueTestPhone();
        await updateProfileByUserId(supabase, user.id, { phone: userPhone });

        const baseGig = (id: string, take_rate: number, employer: string) => ({
          id,
          start_datetime: '2024-01-01T02:24:41Z',
          take_rate,
          income_fees: 12,
          income_total: 40,
          income_tips: 20,
          type: 'rideshare',
          income_total_charge: 120,
          user: user.id,
          employer
        });

        const gigs = [
          ...Array.from({ length: 6 }, (_v, i) => baseGig(`u${i}`, 40, 'Uber Driver')),
          ...Array.from({ length: 5 }, (_v, i) => baseGig(`ul${i}`, 40, 'uber')),
          ...Array.from({ length: 3 }, (_v, i) => baseGig(`l${i}`, 0, 'lyft'))
        ] as ActivityWithTakeRate[];

        const info = await _getPublicTakeRateInfoFromGigsWithTakeRates(gigs);
        await teardownTestUserByUserId(user.id);

        // All 11 Uber rows should land under the canonical "Uber Driver"
        // bucket — the 5 "uber" lowercase rows MUST NOT show up as
        // unsupported.
        expect(info.byPlatform).toHaveLength(1);
        expect(info.byPlatform[0].employer).toEqual('Uber Driver');
        expect(info.byPlatform[0].gigsLength).toEqual(11);
        // Lyft surfaces as the canonical "Lyft Driver" form, never "lyft".
        expect(info.unsupportedEmployers).toEqual(['Lyft Driver']);
      });

      it('throws UnsupportedPlatformError when only unsupported employers are present', async () => {
        const user = await createTestUserByEmail(
          uniqueTestEmail('getpublictakerateinfo-lyft-only')
        );
        const userPhone = uniqueTestPhone();
        await updateProfileByUserId(supabase, user.id, { phone: userPhone });

        const baseGig = (id: string) => ({
          id,
          start_datetime: '2024-01-01T02:24:41Z',
          take_rate: 0,
          income_fees: 12,
          income_total: 40,
          income_tips: 20,
          type: 'rideshare',
          income_total_charge: 120,
          user: user.id,
          employer: 'Lyft Driver'
        });

        const gigs = Array.from({ length: 20 }, (_v, i) =>
          baseGig(`l${i}`)
        ) as ActivityWithTakeRate[];

        await expect(_getPublicTakeRateInfoFromGigsWithTakeRates(gigs)).rejects.toMatchObject({
          name: 'UnsupportedPlatformError',
          unsupportedEmployers: ['Lyft Driver']
        });

        await teardownTestUserByUserId(user.id);
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
          income_total_charge: 120,
          employer: 'Uber Driver'
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
          employer: 'Uber Driver'
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
          employer: 'Uber Driver'
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

        const user = await createTestUserByEmail(uniqueTestEmail('monthssincemindatetoshowis3'));

        const baseGig = (id: string, take_rate: number, start_datetime: string) => ({
          id,
          start_datetime,
          take_rate,
          income_fees: 12,
          income_total: 40,
          income_tips: 20,
          type: 'rideshare',
          income_total_charge: 120,
          user: user.id,
          employer: 'Uber Driver'
        });

        const gigs = [
          baseGig('1', 20, today),
          ...Array.from({ length: 10 }, (_v, i) =>
            baseGig(String(i + 2), 70, threeMonthsOneWeekAgo)
          )
        ] as ActivityWithTakeRate[];

        const publicTakeRateInfo = await _getPublicTakeRateInfoFromGigsWithTakeRates(gigs);
        expect(publicTakeRateInfo.monthsSinceMinDateToShow).toEqual(3);

        await teardownTestUserByUserId(user.id);
      });
    });
  });
});
