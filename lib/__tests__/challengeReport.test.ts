import { challengeReport } from '../challengeReport';
import type { MarkEvent } from '../marks';

const done = (date: string, item: MarkEvent['item'], points = 5): MarkEvent => ({ date, item, points, kind: 'complete', title: item });

it('sums the challenge from the record: what was done, the days shown up, the best run', () => {
    const report = challengeReport([
        done('2026-10-14', 'habit'), done('2026-10-16', 'habit'), done('2026-10-17', 'task', 10),
        done('2026-10-18', 'habit'), done('2026-10-18', 'goal', 50),
        { date: '2026-10-19', item: 'habit', points: -2, kind: 'miss', title: 'missed' },
        { date: '2026-10-19', item: 'task', points: 2, kind: 'add', title: 'added' },
        done('2026-10-01', 'habit'),
    ], '2026-10-27');
    expect(report).toEqual({ daysShownUp: 4, days: 14, habitsKept: 3, tasksDone: 1, goalsReached: 1, bestRun: 3, marksEarned: 77 });
});
