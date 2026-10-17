const mockDb = { runAsync: jest.fn(async () => ({ changes: 1 })), getAllAsync: jest.fn(async () => [{ id: 't1' }]) };
jest.mock('../marksLedger', () => ({ keepPenaltiesOf: jest.fn(async () => undefined) }));
jest.mock('../database', () => ({
    getDatabase: jest.fn(async () => mockDb),
    isSQLiteAvailable: () => true,
    generateId: () => 'id',
    nowISO: () => '2026-09-19T10:00:00.000Z',
}));
jest.mock('../localUser', () => ({ getLocalUserId: jest.fn(async () => 'user') }));

import { deleteTasksForGoal, updateTask } from '../tasks';

const lastCall = () => mockDb.runAsync.mock.calls.at(-1) as unknown as [string, ...unknown[]];

beforeEach(() => jest.clearAllMocks());

describe('editing a task', () => {
    it('clears a due date and notes the user removed', async () => {
        await updateTask('t1', { title: 'Call', dueDate: undefined, description: undefined });
        const [sql, ...params] = lastCall();
        expect(sql).toContain('due_date = ?');
        expect(sql).toContain('description = ?');
        expect(params.slice(0, 3)).toEqual(['Call', null, null]);
    });

    it('keeps fields that were not part of the edit', async () => {
        await updateTask('t1', { title: 'Call' });
        expect(lastCall()[0]).not.toContain('due_date');
    });

    it('never blanks the title or priority', async () => {
        await updateTask('t1', { title: null, priority: null, goalId: null });
        const [sql] = lastCall();
        expect(sql).not.toContain('title = ?');
        expect(sql).not.toContain('priority = ?');
        expect(sql).toContain('goal_id = ?');
    });

    it('marks the edit for backup', async () => {
        await updateTask('t1', { title: 'Call' });
        expect(lastCall()[0]).toContain('synced = 0');
    });
});

describe('deleting a goal', () => {
    it('removes its tasks and marks them for backup', async () => {
        await deleteTasksForGoal('g1');
        const [sql, , goalId] = lastCall();
        expect(sql).toMatch(/UPDATE tasks SET deleted = 1.*synced = 0 WHERE goal_id = \?/);
        expect(goalId).toBe('g1');
    });
});
