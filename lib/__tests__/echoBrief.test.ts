import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { flowDay, type FlowInput } from '../dayFlow';
import { keepsTheFacts, talkingPoints, upcomingDeadlines, writtenLine, writtenLines, type EchoBrief } from '../echoBrief';
import { dayFacts, echoOptions } from '../echoSays';
import { pickFresh, type Said } from '../echoRecent';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const base: EchoBrief = { now: 14 * 60, missed: [], done: 2, total: 5, streak: 3, duels: [], friendsDone: [], friendsFocusing: [] };
const everything: EchoBrief = {
    ...base, name: 'Erwan', scrolled: 30, passedBy: { name: 'Alex', rank: 3 }, rank: 3,
    duels: [{ name: 'Sam', me: 40, them: 60, daysLeft: 2 }], missed: ['Groceries', 'Walk'],
    onNow: { title: 'Study', minutesIn: 40, minutesLeft: 20 }, next: { title: 'Emails', at: '3:00 PM' },
    friendsDone: [{ name: 'Mia', done: 6 }], friendsFocusing: [{ name: 'Leo', on: 'Thesis' }],
    early: { title: 'Read', minutes: 12 }, freeFor: 30,
    deadlines: [{ title: 'Launch site', daysLeft: 3, kind: 'goal', progress: 40 }],
};

describe('what Echo talks about', () => {
    it('the most pressing first: scrolling, then a friend passing you, then a duel you are losing', () => {
        expect(talkingPoints(everything).slice(0, 4).map(point => point.kind)).toEqual(['scrolling', 'passed', 'duel', 'missed']);
    });
    it('every line, in every voice, says the real thing (the title, the name, the number)', () => {
        for (const point of talkingPoints(everything)) {
            for (const { id } of PERSONALITY_MODES) {
                for (const written of writtenLines(point, everything, id)) {
                    const line = written.toLowerCase();
                    for (const key of point.keys) expect(line).toContain(key.toLowerCase());
                }
            }
        }
    });
    it('scrolling while something is on names both', () => {
        const [point] = talkingPoints(everything);
        expect(writtenLine(point, everything, 'bully_mode')).toMatch(/30 minutes.*Study/);
    });
    it('nothing to say is nothing, not a random phrase', () => {
        expect(talkingPoints({ ...base, done: 0, total: 0, now: 600 })).toEqual([]);
    });
});

describe("the model's rephrasing is kept only when it still says the same thing", () => {
    const [point] = talkingPoints({ ...base, onNow: { title: 'Study', minutesIn: 10, minutesLeft: 20 } });
    it('keeps a real sentence with the facts', () => {
        expect(keepsTheFacts('Study is on, twenty minutes to go. Move.', point)).toBe(true);
    });
    it('throws away the kind of line that made no sense', () => {
        expect(keepsTheFacts('You want to kill me now because you are a total waste of your chance at being lazy and your mom did not raise you to be lazy!', point)).toBe(false);
        expect(keepsTheFacts('Study study study study study study study study.', point)).toBe(false);
        expect(keepsTheFacts(null, point)).toBe(false);
    });
});

describe('the day Echo knows', () => {
    const task = (id: string, extra: Partial<FlowInput> = {}): FlowInput => ({ id, kind: 'task', title: id, start: null, minutes: 60, done: false, ...extra });
    it('is the timeline at this minute: on now, next, missed, done', () => {
        const flow = flowDay([task('Study', { kept: { start: 840, end: 900 } }), task('Emails', { kept: { start: 900, end: 930 } }),
            task('Groceries', { kept: { start: 600, end: 660 } }), task('Read', { done: true, doneAt: 700, planned: { start: 660, end: 720 } })], 860, { wake: 420, sleep: 1380 });
        const facts = dayFacts(flow, 860);
        expect(facts.onNow).toEqual({ title: 'Study', minutesIn: 20, minutesLeft: 40 });
        expect(facts.next?.title).toBe('Emails');
        expect(facts.missed).toEqual(['Groceries']);
        expect([facts.done, facts.total]).toEqual([1, 4]);
    });
    it('stays small however much there is: the facts for the model are a few lines at most', () => {
        const busy = { ...everything, missed: Array.from({ length: 400 }, (_, index) => `Thing ${index}`) };
        for (const point of talkingPoints(busy)) expect(point.facts.length).toBeLessThan(260);
    });
});

describe('when your apps have had you a while', () => {
    const { scrollLines } = require('../echoScroll') as typeof import('../echoScroll');
    it('a line for every threshold, in your voice, about what is on now', () => {
        const lines = scrollLines('bully_mode', { ...base, onNow: { title: 'Study', minutesIn: 10, minutesLeft: 50 } });
        expect(Object.keys(lines).sort()).toEqual(['120', '15', '30', '45', '60', '90', 'title']);
        expect(lines['30']).toMatch(/30 minutes/);
        expect(lines['30']).toMatch(/Study/);
    });
});

describe('Echo never goes on repeat', () => {
    // Refresh Home a dozen times with nothing changing: the old Echo alternated two lines.
    const refreshes = (brief: EchoBrief, times: number) => {
        let said: Said[] = [];
        const shown: string[] = [];
        for (let i = 0; i < times; i++) {
            const pick = pickFresh(echoOptions('bully_mode', brief, () => 0.3), said)
                ?? { topic: 'bank', line: `bank line ${i}` };
            shown.push(pick.line);
            said = [{ line: pick.line, topic: pick.topic, at: i }, ...said].slice(0, 30);
        }
        return { shown, said };
    };
    it('no line comes back within a dozen refreshes', () => {
        const { shown } = refreshes(everything, 12);
        expect(new Set(shown).size).toBe(shown.length);
    });
    it('never raises the same thing twice in a row', () => {
        const { said } = refreshes(everything, 12);
        for (let i = 1; i < said.length; i++) if (said[i].topic !== 'bank') expect(said[i].topic).not.toBe(said[i - 1].topic);
    });
    it('with only one thing going on, it says it, then moves on, then comes back in other words', () => {
        const quiet = { ...base, onNow: { title: 'Study', minutesIn: 5, minutesLeft: 25 } };
        const { shown } = refreshes(quiet, 6);
        const study = shown.filter(line => line.includes('Study'));
        expect(study.length).toBeGreaterThanOrEqual(2);
        expect(new Set(study).size).toBe(study.length);
        expect(shown[0]).toContain('Study');
        expect(shown[1]).not.toContain('Study');
    });
});

describe('what is due soon', () => {
    it('goals within a week and not reached, tasks in the next three days, nearest first', () => {
        const due = upcomingDeadlines(
            [{ title: 'Run 10k', daysLeft: 3, progress: 40 }, { title: 'Far off', daysLeft: 30, progress: 10 }, { title: 'Reached', daysLeft: 2, progress: 100 }],
            [{ title: 'Essay', dueDate: '2026-11-12', status: 'open' }, { title: 'Done one', dueDate: '2026-11-12', status: 'done' }, { title: 'Today', dueDate: '2026-11-11', status: 'open' }],
            '2026-11-11');
        expect(due.map(item => item.title)).toEqual(['Essay', 'Run 10k']);
    });
    it('Echo says it with the title and when', () => {
        const point = talkingPoints({ ...base, deadlines: [{ title: 'Run 10k', daysLeft: 3, kind: 'goal', progress: 40 }] }).find(item => item.kind === 'deadline')!;
        expect(writtenLine(point, { ...base, deadlines: [{ title: 'Run 10k', daysLeft: 3, kind: 'goal', progress: 40 }] }, 'normal')).toMatch(/Run 10k.*in 3 days/);
    });
});
