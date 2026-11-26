const mockDb = { runAsync: jest.fn(async () => ({ changes: 1 })), getAllAsync: jest.fn(async () => [{ id: 't1' }]) };
jest.mock('../marksLedger', () => ({ keepPenaltiesOf: jest.fn(async () => undefined) }));
jest.mock('../database', () => ({
    getDatabase: jest.fn(async () => mockDb),
    isSQLiteAvailable: () => true,
    generateId: () => 'id',
    nowISO: () => '2026-09-19T10:00:00.000Z',
}));
jest.mock('../localUser', () => ({ getLocalUserId: jest.fn(async () => 'user') }));

import { updateTask } from '../tasks';

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
        await updateTask('t1', { title: null, priority: null, dueDate: null });
        const [sql] = lastCall();
        expect(sql).not.toContain('title = ?');
        expect(sql).not.toContain('priority = ?');
        expect(sql).toContain('due_date = ?');
    });

    it('marks the edit for backup', async () => {
        await updateTask('t1', { title: 'Call' });
        expect(lastCall()[0]).toContain('synced = 0');
    });
});
