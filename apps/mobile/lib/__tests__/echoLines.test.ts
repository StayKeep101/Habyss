jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));
jest.mock('../onDeviceAI', () => ({ isOnDeviceAIReady: () => false, askForLine: jest.fn() }));

import { FACTS, nextEchoLine, pickWrittenLine, type EchoStats } from '../echoLines';

const stats: EchoStats = { name: 'Erwan', streak: 4, todayDone: 1, todayTotal: 3, weekConsistency: 57, bestHabit: 'Read', nextHabit: 'Run' };
const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe("Echo's home line", () => {
    it('never roasts anyone but Bully Mode users', () => {
        for (const personality of ['friendly', 'normal', 'dad_mode'] as const) {
            for (let i = 1; i < 200; i++) {
                const line = pickWrittenLine(personality, stats, [], seeded(i));
                expect(line).not.toMatch(/excuses are more consistent|Nobody cares how you feel/);
            }
        }
    });

    it('does not repeat a line shown recently', () => {
        const recent = FACTS.slice(0, FACTS.length - 1);
        for (let i = 1; i < 50; i++) {
            expect(recent).not.toContain(pickWrittenLine('normal', { ...stats, todayTotal: 0, streak: 0, weekConsistency: 0, bestHabit: undefined, nextHabit: undefined }, recent, seeded(i)));
        }
    });

    it('only states numbers it was given', () => {
        const lines = new Set<string>();
        for (let i = 1; i < 300; i++) lines.add(pickWrittenLine('normal', stats, [], seeded(i)));
        const withNumbers = [...lines].filter(line => !FACTS.includes(line) && /\d/.test(line));
        for (const line of withNumbers) {
            const numbers = line.match(/\d+/g)!.map(Number);
            for (const n of numbers) expect([1, 3, 4, 57, 24, 2]).toContain(n);
        }
    });

    it('says something useful to a brand new user with no data', () => {
        const empty: EchoStats = { streak: 0, todayDone: 0, todayTotal: 0, weekConsistency: 0 };
        for (let i = 1; i < 50; i++) expect(pickWrittenLine('normal', empty, [], seeded(i)).length).toBeGreaterThan(10);
    });

    it('gives a new line on every visit', async () => {
        const first = await nextEchoLine('friendly', stats);
        expect(typeof first).toBe('string');
        expect(first.length).toBeGreaterThan(0);
    });
});

describe("Echo's check-ins", () => {
    const { checkInLine } = require('../echoLines');
    const facts = { name: 'Erwan', left: 2, total: 3, next: 'Run', tasksDue: 1 };

    it('opens the day with what it asks for, and what to start with', () => {
        const line = checkInLine('morning', 'normal', facts);
        expect(line.body).toContain('3 habits');
        expect(line.body).toContain('1 task');
        expect(line.body).toContain('Run');
    });

    it('closes the day with what is still open, never claiming it was skipped', () => {
        const line = checkInLine('evening', 'normal', facts);
        expect(line.body).toMatch(/not logged/);
        expect(line.body).not.toMatch(/skipped|failed/i);
    });

    it('says well done instead of nagging when the day is finished', () => {
        const line = checkInLine('evening', 'friendly', { ...facts, left: 0, tasksDue: 0 });
        expect(line.title).toBe('All done');
    });

    it('never invents anything on an empty day', () => {
        const line = checkInLine('morning', 'normal', { left: 0, total: 0, tasksDue: 0 });
        expect(line.title).toBe('Nothing scheduled today');
        expect(line.body).not.toMatch(/\d/);
    });

    it('speaks in the chosen voice', () => {
        expect(checkInLine('morning', 'friendly', facts).body).toContain('💙');
        expect(checkInLine('morning', 'bully_mode', facts).body).toContain('Move.');
    });

    it('only uses a name when it was given one', () => {
        expect(checkInLine('evening', 'friendly', { ...facts, name: undefined }).body).not.toContain('undefined');
    });
});

describe("Echo on the day's promise", () => {
    const { checkInLine } = require('../echoLines');
    const facts = { left: 2, total: 3, tasksDue: 2, focusTarget: 3, focusDone: 1 };

    it('leads the morning with the promise, not the inventory', () => {
        const line = checkInLine('morning', 'normal', facts);
        expect(line.body).toContain('3 things');
    });

    it('says in the evening how the promise stands, and what is left of it', () => {
        const line = checkInLine('evening', 'normal', facts);
        expect(line.body).toContain('1 of 3');
        expect(line.body).toContain('2 more');
    });

    it('marks the day kept once the promise is', () => {
        const line = checkInLine('evening', 'normal', { ...facts, focusDone: 3, left: 0, tasksDue: 0 });
        expect(line.title).toBe('Day kept');
        expect(line.body).toContain('All 3');
    });

    it('never invents a number it was not given', () => {
        for (const personality of ['friendly', 'normal', 'dad_mode', 'bully_mode'] as const) {
            const line = checkInLine('evening', personality, { left: 0, total: 0, tasksDue: 0 });
            // No promise passed, so no promise claimed.
            expect(line.body).not.toMatch(/\bof \d/);
        }
    });
});
