import { randomUUID } from 'crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { supabase } from '@src/lib/server/db';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import { decodeAuditCursor, fetchAuditPage, type AuditPageQuery } from './auditFeed';

/**
 * The fixtures are dated far in the future so they sit at the head of the feed
 * regardless of whatever else the suite has written to the three audit tables
 * while this file runs. Paging from the head therefore reaches them first, and
 * the assertions never depend on rows this test does not own.
 */
const BASE = Date.parse('2099-01-01T00:00:00Z');
const at = (secondsIn: number, micros = 0) =>
  `${new Date(BASE + secondsIn * 1000).toISOString().replace('.000Z', '')}.${String(micros).padStart(6, '0')}+00:00`;

/**
 * Two of these share an instant to the microsecond — the shape a single request
 * writing to two audit tables produces, since `now()` is transaction time. The
 * pair straddles a page boundary below, which is exactly where a cursor keyed
 * on the timestamp alone loses a row.
 */
// A microsecond value with no trailing zeros, so PostgREST returns the
// fraction back verbatim rather than trimming it.
const TIED_AT = at(3, 123456);

const ACTOR_EMAIL = uniqueTestEmail('auditfeed-actor');
const DRIVER_EMAIL = uniqueTestEmail('auditfeed-driver');

let actorId: string;
let driverId: string;
let organizationId: string;

const adminRowId = randomUUID();
const organizerRowId = randomUUID();
const tiedAdminRowId = randomUUID();
const tiedOrganizerRowId = randomUUID();
const downloadRowId = randomUUID();
const oldestAdminRowId = randomUUID();

/** Fixture ids, newest-first, with the tied pair broken by id descending. */
let expectedOrder: string[];

const page = (overrides: Partial<AuditPageQuery> = {}) =>
  fetchAuditPage({ source: 'all', cursor: null, direction: 'older', pageSize: 3, ...overrides });

beforeAll(async () => {
  const actor = await createTestUserByEmail(ACTOR_EMAIL, true);
  const driver = await createTestUserByEmail(DRIVER_EMAIL, true);
  actorId = actor.id;
  driverId = driver.id;

  const { data: organization } = await supabase
    .from('affiliate_organizations')
    .insert({ key: `auditfeed-${randomUUID()}`, name: 'Audit feed fixture' })
    .select('id')
    .single();
  if (!organization) throw new Error('fixture organization missing');
  organizationId = organization.id;

  await supabase
    .from('admin_activity_log')
    .insert([
      {
        id: adminRowId,
        admin_user_id: actorId,
        admin_email: ACTOR_EMAIL,
        action: 'fixture.newest',
        target_type: 'organization',
        target_id: organizationId,
        created_at: at(5)
      },
      {
        id: tiedAdminRowId,
        admin_user_id: actorId,
        admin_email: ACTOR_EMAIL,
        action: 'fixture.tied',
        created_at: TIED_AT
      },
      {
        id: oldestAdminRowId,
        admin_user_id: actorId,
        admin_email: ACTOR_EMAIL,
        action: 'fixture.oldest',
        created_at: at(1)
      }
    ])
    .throwOnError();

  await supabase
    .from('organizer_logging')
    .insert([
      { id: organizerRowId, user_id: actorId, action: 'logged_in', created_at: at(4) },
      { id: tiedOrganizerRowId, user_id: actorId, action: 'viewed_user_page', created_at: TIED_AT }
    ])
    .throwOnError();

  await supabase
    .from('driver_data_downloads_by_organizers')
    .insert({
      id: downloadRowId,
      downloading_user_id: actorId,
      downloaded_user_data_id: driverId,
      includes_pdf: true,
      affiliate_organization_id: organizationId,
      created_at: at(2)
    })
    .throwOnError();

  const tied = [tiedAdminRowId, tiedOrganizerRowId].sort().reverse();
  expectedOrder = [adminRowId, organizerRowId, ...tied, downloadRowId, oldestAdminRowId];
});

afterAll(async () => {
  await supabase.from('affiliate_organizations').delete().eq('id', organizationId);
  await teardownTestUserByUserId(actorId);
  await teardownTestUserByUserId(driverId);
});

describe('fetchAuditPage', () => {
  it('merges the three sources into one newest-first stream', async () => {
    const first = await page({ pageSize: 6 });

    expect(first.events.slice(0, 6).map((e) => e.id)).toEqual(expectedOrder);
    expect(first.newer).toBeNull(); // head of the feed
    // Nothing is asserted about `older` here: whether a seventh row exists
    // depends on what the rest of the suite has written, which this test does
    // not own. The paging tests below cover it with fixtures only.
  });

  it('pages forward without dropping or repeating a row across a tied timestamp', async () => {
    const first = await page();
    expect(first.events.map((e) => e.id)).toEqual(expectedOrder.slice(0, 3));
    // The boundary lands between the two rows sharing TIED_AT.
    expect(first.events[2].at).toBe(TIED_AT);

    const second = await page({ cursor: decodeAuditCursor(first.older) });
    expect(second.events.map((e) => e.id)).toEqual(expectedOrder.slice(3, 6));
    expect(second.events[0].at).toBe(TIED_AT);

    const seen = [...first.events, ...second.events].map((e) => e.id);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('pages back toward the head and lands on the same rows', async () => {
    const first = await page();
    const second = await page({ cursor: decodeAuditCursor(first.older) });

    const back = await page({ cursor: decodeAuditCursor(second.newer), direction: 'newer' });

    expect(back.events.map((e) => e.id)).toEqual(first.events.map((e) => e.id));
    expect(back.older).not.toBeNull();
  });

  it('filters by source and keeps the filter while paging', async () => {
    const adminOnly = await page({ source: 'admin', pageSize: 2 });

    expect(adminOnly.events.map((e) => e.source)).toEqual(['admin', 'admin']);
    expect(adminOnly.events.map((e) => e.id)).toEqual([adminRowId, tiedAdminRowId]);

    const next = await page({
      source: 'admin',
      pageSize: 2,
      cursor: decodeAuditCursor(adminOnly.older)
    });
    expect(next.events.map((e) => e.id)[0]).toBe(oldestAdminRowId);
  });

  it('resolves the actor to an email and normalizes each source', async () => {
    const { events } = await page({ pageSize: 6 });
    const byId = new Map(events.map((e) => [e.id, e]));

    // Admin rows carry the email captured at write time.
    expect(byId.get(adminRowId)).toMatchObject({
      source: 'admin',
      actor: ACTOR_EMAIL,
      action: 'fixture.newest',
      target: `organization: ${organizationId}`
    });
    // The other two sources store only a user id; the view resolves it.
    expect(byId.get(organizerRowId)).toMatchObject({
      source: 'organizer',
      actor: ACTOR_EMAIL,
      action: 'logged_in'
    });
    expect(byId.get(downloadRowId)).toMatchObject({
      source: 'download',
      actor: ACTOR_EMAIL,
      action: 'downloaded_driver_data',
      target: driverId
    });
    expect(byId.get(downloadRowId)?.detail).toMatchObject({ includesPdf: true });
  });

  it('counts every event matching the filter, not just the page', async () => {
    const small = await page({ source: 'admin', pageSize: 1 });

    expect(small.events).toHaveLength(1);
    expect(small.total).toBeGreaterThanOrEqual(3);
  });
});

describe('admin_audit_events exposure', () => {
  it('is not readable with the public anon key', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const { PUB_VITE_SUPABASE_URL, PUB_VITE_SUPABASE_ANON_KEY } = await import(
      '$env/static/public'
    );
    const anon = createClient(PUB_VITE_SUPABASE_URL, PUB_VITE_SUPABASE_ANON_KEY);

    const { data, error } = await anon.from('admin_audit_events').select('id').limit(1);

    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });
});
