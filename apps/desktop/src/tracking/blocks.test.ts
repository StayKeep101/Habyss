import { describe, expect, it } from 'vitest';
import type { Interval } from '../types';
import type { TodayItem } from '../today/today';
import { matchItem, mergeBlocks } from './blocks';

const T0 = new Date('2026-11-26T09:00:00').getTime();
const S = 1000, M = 60_000;
let n = 0;
const iv = (name: string, start: number, end: number, over: Partial<Interval> = {}): Interval => ({ id: `i${n++}`, application_id: null, bundle_id: `b.${name}`, name, title: null, start: T0 + start, end: T0 + end, state: 'active', category: 'writing', availability: 'available', pid: 1, window_id: null, url: null, domain: null, document: null, typing_ms: 0, pointer_ms: 0, meeting_ms: 0, media_ms: 0, ...over });
const DAY = [T0 - 9 * 3600_000, T0 + 15 * 3600_000] as const;

describe('mergeBlocks', () => {
  it('folds a short interruption into the stretch around it and counts the switch', () => {
    const blocks = mergeBlocks([iv('Word', 0, 20 * M, { title: 'BA Assignment 3' }), iv('Slack', 20 * M, 21 * M), iv('Word', 21 * M, 40 * M, { title: 'BA Assignment 3' })], ...DAY);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ app: 'Word', title: 'BA Assignment 3', start: T0, end: T0 + 40 * M, switches: 1, activeMs: 40 * M, longestMs: 20 * M });
    expect(blocks[0].parts.map(p => p.label)).toEqual(['BA Assignment 3', 'Slack']);
  });

  it('keeps hundreds of tiny switches readable, and fast', () => {
    const spans = Array.from({ length: 300 }, (_, i) => iv(i % 2 ? 'Chrome' : 'Code', i * 20 * S, (i + 1) * 20 * S));
    const t = performance.now();
    const blocks = mergeBlocks(spans, ...DAY);
    expect(performance.now() - t).toBeLessThan(50);
    expect(blocks.length).toBeLessThanOrEqual(20);
  });

  it('puts a visit under a minute in its neighbour, as one of its parts', () => {
    const blocks = mergeBlocks([iv('Word', 0, 10 * M), iv('Chrome', 10 * M, 10 * M + 30 * S, { domain: 'youtube.com', url: 'https://youtube.com/watch' }), iv('Slack', 30 * M, 40 * M)], ...DAY);
    expect(blocks.map(b => b.app)).toEqual(['Word', 'Slack']);
    expect(blocks[0].parts.map(p => p.label)).toContain('youtube.com');
  });

  it('never makes blocks out of idle, sleep or locked time', () => {
    expect(mergeBlocks([iv('Word', 0, 10 * M, { state: 'idle' }), iv('', 10 * M, 20 * M, { state: 'locked' })], ...DAY)).toEqual([]);
  });

  it('names parts by site, then document, then window, then the app', () => {
    const blocks = mergeBlocks([iv('Arc', 0, 5 * M, { domain: 'github.com' }), iv('Arc', 5 * M, 8 * M, { document: '/Users/me/Notes/Plan.md' }), iv('Arc', 8 * M, 9 * M, { title: 'Settings' }), iv('Arc', 9 * M, 10 * M)], ...DAY);
    expect(blocks[0].parts.map(p => p.label)).toEqual(['github.com', 'Plan.md', 'Settings', 'Arc']);
  });
});

describe('matchItem', () => {
  const item = (id: string, start: number, end: number): TodayItem => ({ id, kind: 'task', title: id, done: false, skipped: false, start, end, state: 'later', locked: false });
  it('is the planned item the block overlaps the longest', () => {
    const [block] = mergeBlocks([iv('Word', 0, 40 * M)], ...DAY);
    expect(matchItem(block, [item('ADM2302', 9 * 60 + 10, 10 * 60), item('Breakfast', 8 * 60, 9 * 60 + 5)], '2026-11-26')?.id).toBe('ADM2302');
    expect(matchItem(block, [item('Later', 12 * 60, 13 * 60)], '2026-11-26')).toBeNull();
  });
});
