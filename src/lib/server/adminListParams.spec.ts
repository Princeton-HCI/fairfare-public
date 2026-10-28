import { describe, it, expect } from 'vitest';
import { parseListParams, ilikePattern } from '@src/lib/server/adminListParams';

const urlWith = (qs: string) => new URL(`https://example.com/admin/x${qs}`);

describe('parseListParams', () => {
  const opts = { allowedSorts: ['created_at', 'name'] as const, defaultSort: 'created_at' };

  it('applies defaults when nothing is provided', () => {
    const p = parseListParams(urlWith(''), opts);
    expect(p).toMatchObject({ q: '', sort: 'created_at', dir: 'desc', page: 1, pageSize: 25 });
    expect(p.rangeFrom).toBe(0);
    expect(p.rangeTo).toBe(24);
  });

  it('falls back to the default sort for a disallowed sort key', () => {
    const p = parseListParams(urlWith('?sort=evil_column'), opts);
    expect(p.sort).toBe('created_at');
  });

  it('honors an allowed sort and ascending direction', () => {
    const p = parseListParams(urlWith('?sort=name&dir=asc'), opts);
    expect(p.sort).toBe('name');
    expect(p.dir).toBe('asc');
  });

  it('computes the range from page and pageSize', () => {
    const p = parseListParams(urlWith('?page=3&pageSize=10'), opts);
    expect(p.page).toBe(3);
    expect(p.pageSize).toBe(10);
    expect(p.rangeFrom).toBe(20);
    expect(p.rangeTo).toBe(29);
  });

  it('clamps invalid page/pageSize to safe values', () => {
    const p = parseListParams(urlWith('?page=-5&pageSize=99999'), opts);
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(100); // maxPageSize default
  });

  it('trims the search query', () => {
    const p = parseListParams(urlWith('?q=%20%20hello%20%20'), opts);
    expect(p.q).toBe('hello');
  });
});

describe('ilikePattern', () => {
  it('wraps the query in % wildcards', () => {
    expect(ilikePattern('uber')).toBe('%uber%');
  });

  it('strips PostgREST filter metacharacters', () => {
    expect(ilikePattern('a,b(c)*d%')).toBe('%a b c  d%');
  });
});
