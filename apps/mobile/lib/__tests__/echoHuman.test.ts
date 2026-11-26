import {
    callbackLine, daysBetween, heardLine, humanMinute, keepLastLine, named, numberWord, OPINIONS, ordinal,
    roughGap, roughMinutes, roughMore, roughShare, SHORT,
} from '../echoHuman';
import type { MemoryNote } from '../echoMemory';

const note = (over: Partial<MemoryNote>): MemoryNote => ({ id: 'n1', kind: 'obstacle', text: 'Mornings are a mess', source: 'you', createdAt: '2026-11-01', ...over });
const voices = ['friendly', 'normal', 'dad_mode', 'bully_mode', 'goofball'] as const;

describe('numbers said like a person', () => {
    it('rounds minutes the way people do', () => {
        expect(roughMinutes(31)).toBe('half an hour');
        expect(roughMinutes(4)).toBe('a few minutes');
        expect(roughMinutes(75)).toBe('over an hour');
        expect(roughMinutes(400)).toBe('most of the day');
    });
    it('says shares, counts and places in words', () => {
        expect(roughShare(47)).toBe('about halfway');
        expect(roughShare(0)).toBe('not started');
        expect(roughMore(2)).toBe('a couple more');
        expect(numberWord(3)).toBe('three');
        expect(numberWord(40)).toBe('40');
        expect(ordinal(3)).toBe('third');
        expect(ordinal(22)).toBe('22nd');
        expect(roughGap(60)).toBe('way');
    });
    it('quotes a one-word name so it reads as a name', () => {
        expect(named('Hello')).toBe('“Hello”');
        expect(named('Read 20 pages')).toBe('Read 20 pages');
    });
});

describe('callbacks: what only someone who knows you would say', () => {
    const base = { voice: 'normal' as const, notes: [], daysAway: 0 };
    it('notices a gap first', () => {
        expect(callbackLine({ ...base, daysAway: 3 })).toMatchObject({ topic: 'callback:away', line: expect.stringMatching(/three days/) });
        for (const voice of voices) expect(callbackLine({ ...base, voice, daysAway: 9 })?.line).toBeTruthy();
    });
    it('brings back yesterday’s answer', () => {
        const line = callbackLine({ ...base, yesterdayAnswer: { question: 'What got in the way today?', answer: 'Too tired after work.' } });
        expect(line?.line).toMatch(/“Too tired after work”/);
    });
    it('uses what you told it, in your words', () => {
        const line = callbackLine({ ...base, notes: [note({})], waiting: '“Run”' }, () => 0);
        expect(line?.line).toMatch(/mornings are a mess/);
        expect(line?.line).toMatch(/“Run”/);
    });
    it('falls back on the help that worked, and is quiet with nothing to say', () => {
        expect(callbackLine({ ...base, bestHelp: { type: 'two_minute', done: 3, tries: 4 }, waiting: 'Study' }, () => 0.9)?.line).toMatch(/two-minute start/);
        expect(callbackLine(base, () => 0.9)).toBeNull();
    });
    it('never quotes a number back at you', () => {
        for (const voice of voices) {
            const line = callbackLine({ ...base, voice, notes: [note({})], waiting: 'Study' }, () => 0)!.line;
            expect(line).not.toMatch(/\d/);
        }
    });
});

describe('shape, character and timing', () => {
    it('has short reactions, opinions and an answer to being told something, in every voice', () => {
        for (const voice of voices) {
            expect(SHORT[voice].praise.length).toBeGreaterThan(0);
            expect(OPINIONS[voice].length).toBeGreaterThan(1);
            expect(heardLine(voice, 'blocker')).toBeTruthy();
        }
    });
    it('keeps the line when you glance back within a few minutes, about the same thing', () => {
        const now = 1_000_000;
        expect(keepLastLine({ line: 'x', at: now - 60_000, situation: 'onNow:Study' }, 'onNow:Study', now)).toBe(true);
        expect(keepLastLine({ line: 'x', at: now - 10 * 60_000, situation: 'onNow:Study' }, 'onNow:Study', now)).toBe(false);
        expect(keepLastLine({ line: 'x', at: now - 60_000, situation: 'next:Emails' }, 'onNow:Study', now)).toBe(false);
    });
    it('lands at a human minute: near the time, never on it, the same all day', () => {
        const at = humanMinute(19 * 60 + 30, 'week-review', '2026-11-15');
        expect(at).not.toBe(19 * 60 + 30);
        expect(Math.abs(at - (19 * 60 + 30))).toBeLessThanOrEqual(6);
        expect(humanMinute(19 * 60 + 30, 'week-review', '2026-11-15')).toBe(at);
    });
    it('counts days between two days', () => {
        expect(daysBetween('2026-11-04', '2026-11-11')).toBe(7);
    });
});
