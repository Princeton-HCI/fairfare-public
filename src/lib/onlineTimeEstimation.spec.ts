import { describe, it, expect } from 'vitest';
import {
  predictActualHours,
  estimateScreenshotHours,
  calculateMissedOpportunities,
  type PeriodMetrics
} from '@src/lib/onlineTimeEstimation';

/** Minimal PeriodMetrics for testing calculateMissedOpportunities */
function makePeriodMetrics(overrides: Partial<PeriodMetrics> = {}): PeriodMetrics {
  return {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    workingDays: 31,
    weeks: 4,
    totalTrips: 0,
    totalEarnings: 0,
    avgDailyOnlineHours: 0,
    avgDailyHourlyPay: 0,
    totalOnlineHours: 0,
    avgHourlyPay: 0,
    weeklyData: [],
    ...overrides
  };
}

describe('onlineTimeEstimation', () => {
  describe('predictActualHours', () => {
    it('returns 0 for zero screenshot hours', () => {
      expect(predictActualHours(0)).toBe(0);
    });

    it('returns 0 for negative screenshot hours', () => {
      expect(predictActualHours(-10)).toBe(0);
    });

    it('applies Ridge formula: 0.71 * screenshot + 8.83', () => {
      // 0.71 * 10 + 8.83 = 7.1 + 8.83 = 15.93
      expect(predictActualHours(10)).toBeCloseTo(15.93, 10);
    });

    it('round-trips with estimateScreenshotHours for positive actual hours', () => {
      const actual = 20;
      const screenshot = estimateScreenshotHours(actual);
      const predicted = predictActualHours(screenshot);
      expect(predicted).toBeCloseTo(actual, 10);
    });
  });

  describe('estimateScreenshotHours', () => {
    it('returns 0 when actual hours <= intercept (8.83)', () => {
      expect(estimateScreenshotHours(0)).toBe(0);
      expect(estimateScreenshotHours(8)).toBe(0);
      expect(estimateScreenshotHours(8.83)).toBe(0);
    });

    it('returns 0 for negative actual hours', () => {
      expect(estimateScreenshotHours(-5)).toBe(0);
    });

    it('applies inverse formula: (actual - 8.83) / 0.71', () => {
      // (20 - 8.83) / 0.71 = 11.17 / 0.71 ≈ 15.732
      expect(estimateScreenshotHours(20)).toBeCloseTo(15.732394366, 9);
    });

    it('round-trips with predictActualHours for positive screenshot hours', () => {
      const screenshot = 14;
      const actual = predictActualHours(screenshot);
      const back = estimateScreenshotHours(actual);
      expect(back).toBeCloseTo(screenshot, 10);
    });
  });

  describe('calculateMissedOpportunities', () => {
    it('returns zero missed when before/after and during all have no data', () => {
      const empty = makePeriodMetrics({
        workingDays: 14,
        totalOnlineHours: 0,
        totalEarnings: 0,
        avgDailyOnlineHours: 0,
        avgHourlyPay: 0
      });
      const result = calculateMissedOpportunities(empty, empty, empty);
      expect(result.missedHours).toBe(0);
      expect(result.missedEarnings).toBe(0);
      expect(result.baselineDailyHours).toBe(0);
      // baselineHourlyPay may be capped to MAX_REASONABLE (50) when no data
      expect(result.baselineHourlyPay).toBeGreaterThanOrEqual(0);
    });

    it('full deactivation: baseline hours but zero during => missed = expected hours', () => {
      const before = makePeriodMetrics({
        avgDailyOnlineHours: 8,
        totalOnlineHours: 80,
        totalEarnings: 800,
        avgHourlyPay: 10,
        workingDays: 10,
        weeklyData: []
      });
      const during = makePeriodMetrics({
        workingDays: 7,
        totalOnlineHours: 0,
        totalEarnings: 0,
        avgDailyOnlineHours: 0,
        avgHourlyPay: 0
      });
      const after = makePeriodMetrics({ totalOnlineHours: 0, totalEarnings: 0 });
      const result = calculateMissedOpportunities(before, during, after);
      // Expected = 8 * 7 = 56 hours, actual = 0 => missed 56
      expect(result.missedHours).toBeCloseTo(56, 5);
      expect(result.baselineDailyHours).toBe(8);
      expect(result.baselineHourlyPay).toBe(10);
      expect(result.missedEarnings).toBeCloseTo(560, 5); // 56 * 10
    });

    it('partial deactivation: baseline more than actual during => missed = difference', () => {
      const before = makePeriodMetrics({
        avgDailyOnlineHours: 6,
        totalOnlineHours: 60,
        totalEarnings: 600,
        avgHourlyPay: 10,
        workingDays: 10
      });
      const during = makePeriodMetrics({
        workingDays: 7,
        totalOnlineHours: 21, // 3 hrs/day
        totalEarnings: 210,
        avgDailyOnlineHours: 3,
        avgHourlyPay: 10
      });
      const after = makePeriodMetrics({ totalOnlineHours: 0 });
      const result = calculateMissedOpportunities(before, during, after);
      // Expected = 6 * 7 = 42, actual = 21 => missed 21 hours
      expect(result.missedHours).toBeCloseTo(21, 5);
      expect(result.missedEarnings).toBeCloseTo(210, 5);
    });

    it('no missed when during equals or exceeds baseline expectation', () => {
      const before = makePeriodMetrics({
        avgDailyOnlineHours: 5,
        totalOnlineHours: 50,
        totalEarnings: 500,
        avgHourlyPay: 10,
        workingDays: 10
      });
      const during = makePeriodMetrics({
        workingDays: 7,
        totalOnlineHours: 35, // 5 * 7
        totalEarnings: 350,
        avgDailyOnlineHours: 5,
        avgHourlyPay: 10
      });
      const after = makePeriodMetrics({ totalOnlineHours: 0 });
      const result = calculateMissedOpportunities(before, during, after);
      expect(result.missedHours).toBe(0);
      expect(result.missedEarnings).toBe(0);
    });

    it('uses after period for baseline daily hours when before has none (sparse data)', () => {
      const before = makePeriodMetrics({
        avgDailyOnlineHours: 0,
        totalOnlineHours: 0,
        totalEarnings: 0
      });
      const during = makePeriodMetrics({
        workingDays: 14,
        totalOnlineHours: 0,
        totalEarnings: 0
      });
      const after = makePeriodMetrics({
        avgDailyOnlineHours: 7,
        totalOnlineHours: 70,
        totalEarnings: 700,
        avgHourlyPay: 10,
        workingDays: 10
      });
      const result = calculateMissedOpportunities(before, during, after);
      expect(result.baselineDailyHours).toBe(7);
      // Expected = 7 * 14 = 98, actual = 0 => missed 98
      expect(result.missedHours).toBeCloseTo(98, 5);
      expect(result.missedEarnings).toBeCloseTo(980, 5);
    });
  });
});
