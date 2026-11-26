import { pressureLine, taskPressure } from '../taskPressure';
import type { Task } from '../tasks';

const TODAY = '2026-10-22';
const day = { wake: 420, sleep: 1380 };
const task = (id: string, extra: Partial<Task>): Task => ({ id, title: id, status: 'open', ...extra } as Task);

describe('how far behind on tasks', () => {
    it('is calm with nothing late and the day young', () => {
        const p = taskPressure([task('a', { dueDate: TODAY })], TODAY, 480, day);
        expect(p.level).toBe(0);
        expect(pressureLine(p, 'bully_mode')).toBeNull();
    });

    it('gets more worried as deadlines pass and the day runs out', () => {
        const late = task('Essay', { dueDate: '2026-10-19', deadline: '2026-10-21' });
        // One late task alone: no "concerned" step any more, Echo stays calm.
        expect(taskPressure([late], TODAY, 480, day).level).toBe(0);
        const two = [late, task('Report', { deadline: '2026-10-20' })];
        expect(taskPressure(two, TODAY, 480, day).level).toBe(2);
        // Evening, today's three still open and no time left for them.
        const today = ['x', 'y', 'z'].map(id => task(id, { dueDate: TODAY, estimatedMinutes: 90 }));
        expect(taskPressure([...two, ...today], TODAY, 1200, day).level).toBeGreaterThanOrEqual(3);
    });

    it('reaches demon mode when far behind, and names what is late', () => {
        const old = ['A', 'B', 'C'].map(id => task(id, { deadline: '2026-10-15' }));
        const p = taskPressure(old, TODAY, 600, day);
        expect(p.level).toBe(4);
        expect(p.worst).toBe('A');
        expect(pressureLine(p, 'bully_mode', () => 0)).toContain('3 tasks past their deadline');
        // Friendly never insults, even in demon mode.
        expect(pressureLine(p, 'friendly', () => 0)).not.toMatch(/fuck|shit|lazy|useless/i);
    });

    it('does not count done or cancelled tasks', () => {
        const p = taskPressure([task('a', { deadline: '2026-10-01', status: 'done' }), task('b', { deadline: '2026-10-01', status: 'cancelled' })], TODAY, 600, day);
        expect(p.level).toBe(0);
    });
});
