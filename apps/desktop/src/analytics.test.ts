import { describe, it, expect, vi } from 'vitest';
import { countdown, dayRange, focusElapsed, metrics, overlap } from './analytics';
import type { Interval } from './types';
const interval = (start: number, end: number, bundle: string, state = 'active'): Interval => ({ id: String(start), application_id: bundle, bundle_id: bundle, name: bundle, title: null, start, end, state, category: 'research', availability: 'app_only', pid: 1, window_id: null, url: null, domain: null, document: null, typing_ms: 0, pointer_ms: 0, meeting_ms: 0, media_ms: 0 });
describe('observed analytics', () => {
    it('clips intervals to arbitrary boundaries', () => expect(overlap(0, 200, 50, 150)).toBe(100));
    it('distinguishes declared focus from observed active overlap', () => { const m = metrics([interval(0, 100, 'A'), interval(100, 200, 'B', 'idle')], [{ id: 'f', label: 'test', start: 0, end: 200, target_ms: 200, state: 'completed', paused_ms: 0, paused_at: null, item_id: null, item_kind: null }], 0, 200); expect(m.active).toBe(100); expect(m.idle).toBe(100); expect(m.declared).toBe(200); expect(m.observedFocus).toBe(100); });
    it('declared_focus_excludes_paused_time', () => {
        const base = { id: 'f', label: 't', target_ms: 1000, state: 'completed', item_id: null, item_kind: null };
        expect(metrics([], [{ ...base, start: 0, end: 200, paused_ms: 50, paused_at: null }], 0, 200).declared).toBe(150);
        expect(metrics([interval(0, 200, 'A')], [{ ...base, start: 0, end: 200, paused_ms: 50, paused_at: null }], 0, 200).observedFocus).toBe(150);
        expect(metrics([], [{ ...base, start: 0, end: null, state: 'running', paused_ms: 20, paused_at: 150 }], 0, 200, 200).declared).toBe(130);
    });
    it('focusElapsed mirrors the Rust formula', () => {
        const f = { id: 'f', label: 't', start: 0, end: null, target_ms: 1000, state: 'running', paused_ms: 0, paused_at: null, item_id: null, item_kind: null };
        expect(focusElapsed({ ...f, paused_ms: 60000 }, 300000)).toBe(240000);
        expect(focusElapsed({ ...f, paused_at: 100000 }, 400000)).toBe(100000);
        expect(focusElapsed({ ...f, end: 50, paused_ms: 999 }, 900)).toBe(0);
    });
    it('does not count window changes as application switches', () => { const m = metrics([interval(0, 100, 'A'), interval(100, 200, 'A'), interval(200, 300, 'B'), interval(400, 500, 'C')], [], 0, 500); expect(m.switches).toBe(1); expect(m.longest).toBe(300); });
    it('uses calendar midnights', () => { const [from, to] = dayRange('2026-11-01'); expect(new Date(from).getHours()).toBe(0); expect(new Date(to).getDate()).toBe(2); });
});

it('clips local days correctly across DST and timezone changes', () => {
    vi.stubEnv('TZ', 'America/Toronto');
    try {
        const [springStart, springEnd] = dayRange('2026-03-08');
        const [fallStart, fallEnd] = dayRange('2026-11-01');
        expect(springEnd-springStart).toBe(23*3600000);
        expect(fallEnd-fallStart).toBe(25*3600000);
        vi.stubEnv('TZ','UTC');
        const [utcStart,utcEnd] = dayRange('2026-11-01');
        expect(utcEnd-utcStart).toBe(24*3600000);
        expect(utcStart).not.toBe(fallStart);
    } finally { vi.unstubAllEnvs(); }
});
describe('countdown', () => {
    it('rounds_remaining_time_up_like_the_tray', () => {
        // focus.rs title_formats: 25:00 at the start, 00:01 with 999 ms left.
        expect([countdown(1_500_000), countdown(1_499_999), countdown(999), countdown(0), countdown(-5)]).toEqual(['25:00', '25:00', '00:01', '00:00', '00:00']);
    });
});

describe('websites and input', () => {
  it('groups browser time by domain and sums input signals within the range', () => {
    const base = { application_id: null, bundle_id: 'com.google.Chrome', name: 'Chrome', title: null, state: 'active', availability: 'available', pid: 1, window_id: null, document: null, meeting_ms: 0, media_ms: 0 };
    const rows = [
      { ...base, id: 'a', start: 0, end: 60000, category: 'entertainment', url: 'https://youtube.com/watch', domain: 'youtube.com', typing_ms: 0, pointer_ms: 60000 },
      { ...base, id: 'b', start: 60000, end: 180000, category: 'development', url: 'https://github.com/', domain: 'github.com', typing_ms: 120000, pointer_ms: 0 },
      { ...base, id: 'c', start: 180000, end: 240000, category: 'entertainment', url: 'https://youtube.com/x', domain: 'youtube.com', typing_ms: 0, pointer_ms: 0 },
    ];
    const m = metrics(rows, [], 0, 120000, 120000);
    expect(m.sites.map(s => [s.domain, s.ms])).toEqual([['youtube.com', 60000], ['github.com', 60000]]);
    expect(m.input).toEqual({ typing: 60000, pointer: 60000, meeting: 0, media: 0 });
  });
});
