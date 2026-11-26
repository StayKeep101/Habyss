import { describe, expect, it } from 'vitest';
import type { Interval } from '../types';
import { groupUsage, liveIntervals } from './usage';

const iv = (id: string, name: string, start: number, end: number, extra: Partial<Interval> = {}): Interval => ({ id, application_id: null, bundle_id: `b.${name}`, name, title: null, start, end, state: 'active', category: 'development', availability: 'available', pid: 1, window_id: null, url: null, domain: null, document: null, typing_ms: 0, pointer_ms: 0, meeting_ms: 0, media_ms: 0, ...extra });

describe('groupUsage', () => {
  it('merges every span of an app into one row, ranked by time, with its windows merged by name', () => {
    const rows = groupUsage([
      iv('1', 'Code', 0, 60_000, { title: 'a.ts' }), iv('2', 'Slack', 60_000, 90_000), iv('3', 'Code', 90_000, 150_000, { title: 'a.ts' }),
      iv('4', 'Code', 150_000, 160_000, { title: 'b.ts' }), iv('5', 'Code', 160_000, 999_000, { state: 'idle' }),
    ], 0, 1_000_000);
    expect(rows.map(r => [r.name, r.ms, r.sessions])).toEqual([['Code', 130_000, 3], ['Slack', 30_000, 1]]);
    expect(rows[0].details.map(d => [d.label, d.ms])).toEqual([['a.ts', 120_000], ['b.ts', 10_000]]);
  });
  it('groups a browser by site, and sites by path', () => {
    const web = { name: 'Chrome', category: 'browsing' };
    const rows = groupUsage([
      iv('1', 'Chrome', 0, 10_000, { ...web, domain: 'github.com', url: 'https://github.com/a', category: 'development' }),
      iv('2', 'Chrome', 10_000, 40_000, { ...web, domain: 'youtube.com', url: 'https://youtube.com/watch', category: 'entertainment' }),
    ], 0, 100_000, 'site');
    expect(rows.map(r => [r.name, r.ms, r.category, r.details[0].label])).toEqual([['youtube.com', 30_000, 'entertainment', '/watch'], ['github.com', 10_000, 'development', '/a']]);
    expect(groupUsage(rows.length ? [iv('1', 'Chrome', 0, 10_000, { domain: 'github.com' })] : [], 0, 1e6)[0].details[0].label).toBe('github.com');
  });
});

describe('liveIntervals', () => {
  it('runs the current active span up to now, but never more than 10 s past the last snapshot', () => {
    const rows = [iv('current', 'Code', 0, 5_000), iv('x', 'Slack', 0, 5_000)];
    expect(liveIntervals(rows, 8_000).map(r => r.end)).toEqual([8_000, 5_000]);
    expect(liveIntervals(rows, 60_000)[0].end).toBe(15_000);
    expect(liveIntervals([iv('current', 'Code', 0, 5_000, { state: 'idle' })], 8_000)[0].end).toBe(5_000);
  });
});
