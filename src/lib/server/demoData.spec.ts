import { describe, it, expect } from 'vitest';
import { v7 as uuidv7 } from 'uuid';

import { loadDemoArgyleActivities } from './demoData';

describe('demoData', () => {
  describe('loadDemoArgyleActivities', () => {
    const userId = uuidv7();
    const accountId = uuidv7();
    const accountDbId = uuidv7();

    it('returns rows wired to the provided demo driver identifiers', () => {
      const activities = loadDemoArgyleActivities(userId, accountId, accountDbId);
      expect(activities.length).toBeGreaterThan(0);
      activities.forEach((activity) => {
        expect(activity.user).toBe(userId);
        expect(activity.account).toBe(accountId);
        expect(activity.account_id).toBe(accountDbId);
        expect(activity.id).toBeTruthy();
      });
    });

    it('caps to MAX_DEMO_DRIVER_ACTIVITIES (<= 200) rows', () => {
      const activities = loadDemoArgyleActivities(userId, accountId, accountDbId);
      expect(activities.length).toBeLessThanOrEqual(200);
    });

    it('generates a unique id per activity', () => {
      const activities = loadDemoArgyleActivities(userId, accountId, accountDbId);
      const ids = new Set(activities.map((a) => a.id));
      expect(ids.size).toBe(activities.length);
    });

    it('uses real Argyle sandbox shape (Uber Driver employer, rideshare type)', () => {
      const activities = loadDemoArgyleActivities(userId, accountId, accountDbId);
      activities.forEach((activity) => {
        expect(activity.employer).toBe('Uber Driver');
        expect(activity.type).toBe('rideshare');
        expect(['completed', 'cancelled']).toContain(activity.status);
      });
    });

    it('re-anchors timestamps so the latest start_datetime lands at "now" (within a few seconds)', () => {
      const activities = loadDemoArgyleActivities(userId, accountId, accountDbId);
      const startTimes = activities
        .map((a) => (a.start_datetime ? new Date(a.start_datetime).getTime() : null))
        .filter((t): t is number => t !== null);

      expect(startTimes.length).toBeGreaterThan(0);
      const maxStart = Math.max(...startTimes);
      const now = Date.now();
      // Allow a generous window for test execution latency.
      expect(Math.abs(now - maxStart)).toBeLessThan(60_000);
    });

    it('keeps end_datetime after start_datetime when both are set', () => {
      const activities = loadDemoArgyleActivities(userId, accountId, accountDbId);
      activities.forEach((activity) => {
        if (activity.start_datetime && activity.end_datetime) {
          const start = new Date(activity.start_datetime).getTime();
          const end = new Date(activity.end_datetime).getTime();
          expect(end).toBeGreaterThanOrEqual(start);
        }
      });
    });

    it('picks from one of test1/test2/test3 (across enough invocations covers more than one source)', () => {
      // 30 invocations: probability of missing all 3 sources is (2/3)^30 ≈ 5e-6
      const seen = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const activities = loadDemoArgyleActivities(uuidv7(), uuidv7(), uuidv7());
        seen.add(
          `${activities.length}-${activities[0]?.start_location_formatted_address ?? 'null'}`
        );
      }
      expect(seen.size).toBeGreaterThan(1);
    });
  });
});
