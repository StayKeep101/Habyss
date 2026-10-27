import { plannableDays, sectionName, todoGroups, unplanned } from '../goalTodo';
import type { Task } from '../tasks';

const task = (id: string, extra: Partial<Task> = {}): Task => ({
    id, title: id, priority: 2, status: 'open', source: 'app', createdAt: `2026-10-2${id.length}T10:00:00Z`, updatedAt: '', ...extra,
});

describe('a goal to-do list', () => {
    it('puts loose to-dos first, then headings in their saved order, then headings found only on tasks', () => {
        const groups = todoGroups([
            task('a'), task('b', { section: 'Build' }), task('c', { section: 'Research' }), task('d', { section: 'Launch' }),
        ], ['Research', 'Build']);
        expect(groups.map(group => group.section)).toEqual([null, 'Research', 'Build', 'Launch']);
        expect(groups[0].tasks.map(t => t.id)).toEqual(['a']);
    });

    it('keeps an empty heading and orders open, then planned by day, then done; drops cancelled', () => {
        const groups = todoGroups([
            task('done', { section: 'S', status: 'done' }), task('late', { section: 'S', dueDate: '2026-10-30' }),
            task('soon', { section: 'S', dueDate: '2026-10-28' }), task('x', { section: 'S' }), task('gone', { section: 'S', status: 'cancelled' }),
        ], ['S', 'Empty']);
        expect(groups[1].tasks.map(t => t.id)).toEqual(['x', 'soon', 'late', 'done']);
        expect(groups[2]).toEqual({ section: 'Empty', tasks: [] });
    });

    it('offers only open to-dos with no day to plan', () => {
        expect(unplanned([task('a'), task('b', { dueDate: '2026-10-28' }), task('c', { status: 'done' })]).map(t => t.id)).toEqual(['a']);
    });

    it('plans from today to the deadline, or 90 days with none', () => {
        expect(plannableDays('2026-10-27', '2026-11-30')).toEqual({ from: '2026-10-27', to: '2026-11-30' });
        expect(plannableDays('2026-10-27', null).to).toBe('2027-01-25');
        expect(plannableDays('2026-10-27', '2026-10-01').to).toBe('2026-10-27');
    });

    it('tidies a heading name', () => {
        expect(sectionName('  Launch   week ')).toBe('Launch week');
        expect(sectionName('   ')).toBe('');
    });
});
