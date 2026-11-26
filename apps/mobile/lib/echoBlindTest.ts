import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { talkingPoints, writtenLines, type EchoBrief } from './echoBrief';
import { callbackLine, OPINIONS } from './echoHuman';

/**
 * The blind test (docs/echo-blind-test.md): Echo's lines for a fixed set of
 * everyday situations, each described plainly so a human coach can write
 * their own line for the same moment. Mix the two, ask people which is the
 * machine, rewrite whatever gets caught. Pure; printed by
 * `npm run echo:sample`.
 */

export interface Situation { id: string; plainly: string; brief: EchoBrief }

const base: EchoBrief = { now: 9 * 60, missed: [], done: 0, total: 5, streak: 0, duels: [], friendsDone: [], friendsFocusing: [] };

export const SITUATIONS: Situation[] = [
    { id: 'scrolling', plainly: 'They have spent about 40 minutes on social apps today. Their "Study" block is on now.',
        brief: { ...base, now: 15 * 60, scrolled: 40, onNow: { title: '“Study”', minutesIn: 10, minutesLeft: 50 } } },
    { id: 'missed', plainly: 'It is evening. They missed "Gym" and one other thing today.',
        brief: { ...base, now: 19 * 60, missed: ['“Gym”', 'Call mum'], done: 2 } },
    { id: 'onNow', plainly: '"Deep work" is on right now with about 20 minutes left, and they just opened their phone.',
        brief: { ...base, now: 10 * 60, onNow: { title: 'Deep work', minutesIn: 40, minutesLeft: 20 } } },
    { id: 'nothingYet', plainly: 'It is 2 pm. Nothing done yet out of five things planned.',
        brief: { ...base, now: 14 * 60, done: 0, total: 5 } },
    { id: 'dayDone', plainly: 'Everything planned today is done.',
        brief: { ...base, now: 18 * 60, done: 5, total: 5 } },
    { id: 'passed', plainly: 'Their friend Maya just passed them on the leaderboard; they are now third.',
        brief: { ...base, passedBy: { name: 'Maya', rank: 3 } } },
    { id: 'deadline', plainly: 'Their essay is due tomorrow and is about half done.',
        brief: { ...base, deadlines: [{ title: 'Essay', daysLeft: 1, kind: 'task', progress: 50 }] } },
    { id: 'early', plainly: 'They just finished "Emails" about ten minutes early.',
        brief: { ...base, early: { title: '“Emails”', minutes: 11 } } },
];

export interface Sample { situation: string; plainly: string; voice: PersonalityModeId; line: string }

/** Echo's line for every situation in one voice, plus a callback and an opinion. */
export function sampleLines(voice: PersonalityModeId): Sample[] {
    const out: Sample[] = [];
    for (const situation of SITUATIONS) {
        const point = talkingPoints(situation.brief).find(item => item.kind === situation.id) ?? talkingPoints(situation.brief)[0];
        if (!point) continue;
        out.push({ situation: situation.id, plainly: situation.plainly, voice, line: writtenLines(point, situation.brief, voice)[0] });
    }
    const told = callbackLine({ voice, notes: [{ id: 'n', kind: 'obstacle', text: 'Mornings are chaos with the kids', source: 'you', createdAt: '' }], daysAway: 0, waiting: '“Run”' }, () => 0);
    if (told) out.push({ situation: 'callback', plainly: 'Last week they told you mornings are chaos with the kids. Their "Run" is next.', voice, line: told.line });
    out.push({ situation: 'opinion', plainly: 'Nothing in particular is happening. Say something you believe.', voice, line: OPINIONS[voice][0] });
    return out;
}
