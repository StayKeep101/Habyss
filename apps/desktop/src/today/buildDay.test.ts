import { describe, expect, it } from 'vitest';
import type { CloudData, HabitRow, TaskRow } from '../types';
import { buildDay, memoryAfter } from './buildDay';
import { flowDay, flowInputs } from '../shared/dayFlow';
import { rowToHabit, rowToTask } from '../shared/rows';

const DAY = '2026-11-26';
const at = (h: number, m = 0, day = DAY) => new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
const habit = (id: string, over: Partial<HabitRow> = {}): HabitRow => ({ id, user_id: null, name: id, start_date: '2026-01-01', created_at: '2026-01-01T00:00:00', is_archived: 0, deleted: 0, duration_minutes: 30, ...over } as HabitRow);
const task = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({ id, user_id: null, title: id, due_date: DAY, status: 'open', priority: 2, estimated_minutes: 60, created_at: '2026-11-01T00:00:00', deleted: 0, ...over } as TaskRow);
const event = { id: 'E1', title: 'School', start: 14 * 60, minutes: 60 };
const meals = { breakfast: { id: 'breakfast', on: false, time: '07:30', minutes: 20 }, lunch: { id: 'lunch', on: true, time: '12:00', minutes: 30 }, supper: { id: 'supper', on: false, time: '18:30', minutes: 45 } };
const data = (inputs: Record<string, unknown> = {}): CloudData => ({
    habits: [habit('read', { name: 'Read' })],
    tasks: [task('ship', { title: 'Ship' })],
    completions: [],
    day_inputs: { day_window: { wake: '08:00', sleep: '23:30' }, meals, [`events:${DAY}`]: [event], 'travel:#2026-11-26#E1': { before: 30, after: 30 }, ...inputs },
});

describe('buildDay', () => {
    it('builds the day the phone builds from the same synced settings', () => {
        const d = data();
        const day = buildDay(d, { date: DAY, now: at(10), signedIn: true });
        const expected = flowDay(flowInputs({
            habits: [rowToHabit(d.habits[0])], tasks: [rowToTask(d.tasks[0])], done: {}, doneTimes: {}, day: DAY, today: DAY,
            meals: [{ id: 'lunch', name: 'Lunch', start: 720, minutes: 30 }], events: [event], travel: { '#2026-11-26#E1': { before: 30, after: 30 } },
            flexibleMeals: false, rescheduled: {}, ended: {},
        }), 600, { wake: 480, sleep: 1410, peak: null }, { auto: true });
        expect(day.items.map(i => [i.id, i.start, i.end])).toEqual(expected.timeline.map(i => [i.id, i.start, i.end]));
        expect(day.window).toEqual({ wake: 480, sleep: 1410 });
    });

    it('lays out meals, events and the travel either side of an event', () => {
        const day = buildDay(data(), { date: DAY, now: at(10), signedIn: true });
        const row = (id: string) => day.items.find(i => i.id === id);
        expect(row('event:E1')).toMatchObject({ kind: 'event', start: 840, end: 900 });
        expect(row('event:E1:to')).toMatchObject({ start: 810, end: 840 });
        expect(row('event:E1:back')).toMatchObject({ start: 900, end: 930 });
        expect(row('meal:lunch')).toMatchObject({ kind: 'meal', start: 720, end: 750 });
    });

    it('waits for the window it was given, and plans from 7 to 11 only when none is synced', () => {
        const d = data();
        delete d.day_inputs.day_window;
        expect(buildDay(d, { date: DAY, now: at(10), signedIn: true }).window).toEqual({ wake: 420, sleep: 1380 });
    });

    it('a past day has no "now"; yesterday\'s early ends do not touch today', () => {
        const past = buildDay(data(), { date: '2026-11-25', now: at(10), signedIn: true });
        expect(past.items.some(i => i.state === 'now')).toBe(false);
        const withYesterday = buildDay(data({ 'ended:2026-11-25': { 'meal:lunch': 725 } }), { date: DAY, now: at(13), signedIn: true });
        expect(withYesterday.items.find(i => i.id === 'meal:lunch')?.done).toBe(false);
        const withToday = buildDay(data({ [`ended:${DAY}`]: { 'meal:lunch': 725 } }), { date: DAY, now: at(13), signedIn: true });
        expect(withToday.items.find(i => i.id === 'meal:lunch')?.done).toBe(true);
    });

    it('signed out or without data: an empty day', () => {
        expect(buildDay(null, { date: DAY, now: at(10), signedIn: true })).toMatchObject({ items: [], signedIn: false });
        expect(buildDay(data(), { date: DAY, now: at(10), signedIn: false }).items).toEqual([]);
    });

    it('remembers today\'s layout in the account\'s one memory, only when it changed, and never for another day', () => {
        const d = data();
        const first = memoryAfter(d, DAY, at(10));
        expect(first?.key).toBe(`day_memory:${DAY}`);
        expect(first?.memory.day).toBe(DAY);
        expect(memoryAfter({ ...d, day_inputs: { ...d.day_inputs, [`day_memory:${DAY}`]: first!.memory } }, DAY, at(10))).toBeNull();
        expect(memoryAfter(d, '2026-11-25', at(10))).toBeNull();
    });

    it('no device owns the memory: one the phone left is read and carried on, written back only if this look moved something', () => {
        const d = data();
        const settled = memoryAfter(d, DAY, at(10))!.memory;
        // The phone laid the day out the same way: nothing to write.
        expect(memoryAfter({ ...d, day_inputs: { ...d.day_inputs, [`day_memory:${DAY}`]: settled } }, DAY, at(10))).toBeNull();
        // The phone's memory is built on, and saved under the same key both devices read.
        const phone = { day: DAY, slots: { 'event:E1': { start: 840, end: 900 } }, done: {}, moved: {}, lapsed: { ship: true } };
        const next = memoryAfter({ ...d, day_inputs: { ...d.day_inputs, [`day_memory:${DAY}`]: phone } }, DAY, at(10));
        expect(next?.key).toBe(`day_memory:${DAY}`);
        expect(next?.memory.lapsed).toMatchObject({ ship: true });
    });

    it('writes nothing before there is anything to remember', () => {
        expect(memoryAfter({ habits: [], tasks: [], completions: [], day_inputs: {} }, DAY, at(10))).toBeNull();
    });

    it('a task finished early, planned for another day, is not on today\'s timeline, as on the phone', () => {
        const d = data();
        d.tasks = [...d.tasks, task('later', { title: 'Later', due_date: '2026-11-27', status: 'done', completed_at: at(9).toISOString() })];
        const today = buildDay(d, { date: DAY, now: at(10), signedIn: true });
        expect(today.items.some(i => i.id === 'later')).toBe(false);
        const tomorrow = buildDay(d, { date: '2026-11-27', now: at(10), signedIn: true });
        expect(tomorrow.items.some(i => i.id === 'later')).toBe(true);
    });
});
