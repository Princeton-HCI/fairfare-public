import { describe, expect, it } from 'vitest';
import {
  decodeAuditCursor,
  encodeAuditCursor,
  parseAuditPageQuery,
  parseAuditPageSize,
  parseAuditSource,
  DEFAULT_AUDIT_PAGE_SIZE
} from './auditFeed';

const urlWith = (query: string) => new URL(`http://localhost/admin/audit${query}`);

describe('audit cursors', () => {
  it('round-trips a cursor without losing microsecond precision', () => {
    const id = crypto.randomUUID();
    const encoded = encodeAuditCursor({ at: '2026-09-16T10:00:00.123456+00:00', id });

    // No literal `+`, so the cursor survives a form-encoded round trip intact.
    expect(encoded).toBe(`2026-09-16T10:00:00.123456Z|${id}`);
    expect(decodeAuditCursor(encoded)).toEqual({ at: '2026-09-16T10:00:00.123456Z', id });
  });

  it('survives a decoder that turns the `+` of an offset into a space', () => {
    const id = crypto.randomUUID();
    const mangled = new URL(`http://x/?c=2026-09-16T10:00:00+00:00|${id}`).searchParams.get('c');

    expect(decodeAuditCursor(mangled)).toEqual({ at: '2026-09-16T10:00:00+00:00', id });
  });

  it('splits on the last separator so a timestamp may not be mangled', () => {
    const id = crypto.randomUUID();
    expect(decodeAuditCursor(`2026-09-16T10:00:00+00:00|${id}`)).toEqual({
      at: '2026-09-16T10:00:00+00:00',
      id
    });
  });

  it('rejects a malformed cursor rather than passing it to the database', () => {
    expect(decodeAuditCursor(null)).toBeNull();
    expect(decodeAuditCursor('')).toBeNull();
    expect(decodeAuditCursor('no-separator')).toBeNull();
    // A non-uuid id would otherwise reach PostgREST as a filter value.
    expect(decodeAuditCursor('2026-09-16T10:00:00Z|not-a-uuid')).toBeNull();
    expect(decodeAuditCursor(`not-a-date|${crypto.randomUUID()}`)).toBeNull();
    expect(decodeAuditCursor(`|${crypto.randomUUID()}`)).toBeNull();
    // `Date.parse` accepts this (the parenthesized part is treated as a
    // comment), but the comma and parentheses are structural in the PostgREST
    // `or=(...)` expression the timestamp is interpolated into.
    expect(decodeAuditCursor(`2026-01-01 (a,b)|${crypto.randomUUID()}`)).toBeNull();
  });
});

describe('audit query params', () => {
  it('falls back to the whole feed for an unknown source', () => {
    expect(parseAuditSource('admin')).toBe('admin');
    expect(parseAuditSource(null)).toBe('all');
    expect(parseAuditSource('nonsense')).toBe('all');
  });

  it('clamps the page size', () => {
    expect(parseAuditPageSize(null)).toBe(DEFAULT_AUDIT_PAGE_SIZE);
    expect(parseAuditPageSize('10')).toBe(10);
    expect(parseAuditPageSize('99999')).toBe(200);
    expect(parseAuditPageSize('-1')).toBe(DEFAULT_AUDIT_PAGE_SIZE);
    expect(parseAuditPageSize('abc')).toBe(DEFAULT_AUDIT_PAGE_SIZE);
  });

  it('reads the direction from which cursor param is present', () => {
    const id = crypto.randomUUID();
    const at = '2026-09-16T10:00:00Z';
    const encoded = `${at}|${id}`;

    expect(parseAuditPageQuery(urlWith(''))).toMatchObject({
      source: 'all',
      cursor: null,
      direction: 'older'
    });
    expect(parseAuditPageQuery(urlWith(`?before=${encoded}`))).toMatchObject({
      direction: 'older',
      cursor: { at, id }
    });
    expect(parseAuditPageQuery(urlWith(`?after=${encoded}`))).toMatchObject({
      direction: 'newer',
      cursor: { at, id }
    });
  });

  it('restarts at the head when the cursor is unusable', () => {
    expect(parseAuditPageQuery(urlWith('?before=garbage'))).toMatchObject({
      cursor: null,
      direction: 'older'
    });
    // An unusable `after` must not keep the ascending direction: a cursorless
    // ascending scan starts at the tail and would serve the oldest page as if
    // it were the head of the feed.
    expect(parseAuditPageQuery(urlWith('?after=garbage'))).toMatchObject({
      cursor: null,
      direction: 'older'
    });
  });
});
