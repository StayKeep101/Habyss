// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { Today, TodayItem } from '../today/today';

const sent: unknown[] = [];
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: (cmd: string, args: { slots: unknown }) => { if (cmd === 'set_day_plan') sent.push(args.slots); return Promise.resolve(); } }));
import { planSlots, usePlanPublisher } from './usePlanPublisher';

const item = (id: string, over: Partial<TodayItem> = {}): TodayItem => ({ id, kind: 'habit', title: id, done: false, skipped: false, start: 600, end: 630, state: 'later', locked: false, ...over });
const today = (items: TodayItem[]): Today => ({ day: '2026-11-26', items, current: null, next: null, done: 0, total: 0, tasksDone: 0, tasksTotal: 0, listedDone: 0, listedTotal: 0, streak: 0, signedIn: true, window: { wake: 480, sleep: 1380 } });
afterEach(() => { cleanup(); sent.length = 0; });

describe('the plan sent to the pill', () => {
  it('is every open item as epoch ms, keyed like the phone, fixed ones marked', () => {
    const base = new Date('2026-11-26T00:00:00').getTime();
    expect(planSlots(today([item('h'), item('lunch', { kind: 'meal', id: 'meal:lunch', fixed: true }), item('t', { kind: 'task', done: true }), item('p', { part: { index: 2, of: 2 } })]))).toEqual([
      { key: 'habit:h:2026-11-26', title: 'h', start: base + 600 * 60000, end: base + 630 * 60000, fixed: false },
      { key: 'meal:meal:lunch:2026-11-26', title: 'lunch', start: base + 600 * 60000, end: base + 630 * 60000, fixed: true },
      { key: 'habit:p#2:2026-11-26', title: 'p', start: base + 600 * 60000, end: base + 630 * 60000, fixed: false },
    ]);
  });
  it('is sent once for the same plan, and again when it changes', () => {
    const { rerender } = renderHook(({ t }) => usePlanPublisher(t), { initialProps: { t: today([item('h')]) } });
    rerender({ t: today([item('h')]) });
    expect(sent).toHaveLength(1);
    rerender({ t: today([item('h', { done: true })]) });
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual([]);
  });
});
