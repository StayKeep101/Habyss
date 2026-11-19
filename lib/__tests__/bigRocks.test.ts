import { rockCandidates, spreadOverWeek } from '../bigRocks';
import type { Task } from '../tasks';

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, status: 'open', createdAt: `2026-11-0${id.length}`, ...extra } as Task);

describe("next week's big rocks", () => {
    it('puts goals in focus first, then urgent and hard; never done ones', () => {
        const list = [task('loose', { priority: 1 }), task('maintained', { goalId: 'g2' }), task('focused', { goalId: 'g1' }), task('done', { status: 'done' } as Partial<Task>)];
        expect(rockCandidates(list, new Set(['g1'])).map(item => item.id)).toEqual(['focused', 'maintained', 'loose']);
    });

    it('gives one rock a weekday from Monday, at most five', () => {
        expect(spreadOverWeek(['a', 'b'], '2026-11-23')).toEqual({ a: '2026-11-23', b: '2026-11-24' });
        // A week starting Sunday begins on its Monday.
        expect(spreadOverWeek(['a'], '2026-11-22')).toEqual({ a: '2026-11-23' });
        expect(Object.keys(spreadOverWeek(['a', 'b', 'c', 'd', 'e', 'f'], '2026-11-23'))).toHaveLength(5);
    });
});
