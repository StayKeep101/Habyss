import { describe, it, expect, vi } from 'vitest';
import { dayRange, metrics, overlap } from './analytics';
import type { Interval } from './types';
const interval = (start: number, end: number, bundle: string, state = 'active'): Interval => ({ id: String(start), application_id: bundle, bundle_id: bundle, name: bundle, title: null, start, end, state, category: 'research', availability: 'app_only', pid: 1, window_id: null });
describe('observed analytics', () => {
    it('clips intervals to arbitrary boundaries', () => expect(overlap(0, 200, 50, 150)).toBe(100));
    it('distinguishes declared focus from observed active overlap', () => { const m = metrics([interval(0, 100, 'A'), interval(100, 200, 'B', 'idle')], [{ id: 'f', label: 'test', start: 0, end: 200, target_ms: 200, state: 'completed' }], 0, 200); expect(m.active).toBe(100); expect(m.idle).toBe(100); expect(m.declared).toBe(200); expect(m.observedFocus).toBe(100); });
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
