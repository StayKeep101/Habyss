import { csvCell, exportCsv } from '../dataExport';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

describe('export my data', () => {
    it('quotes only cells that need it', () => {
        expect(csvCell('Read')).toBe('Read');
        expect(csvCell('Read, then write')).toBe('"Read, then write"');
        expect(csvCell('Say "no"')).toBe('"Say ""no"""');
    });

    it('writes check-ins, tasks and focus as rows, oldest first', () => {
        const habits = [{ id: 'h', name: 'Run', unit: 'km' }] as unknown as Habit[];
        const tasks = [{ id: 't', title: 'Send proposal', status: 'done', completedAt: '2026-11-02T10:00:00', createdAt: '2026-11-01T09:00:00', updatedAt: '2026-11-02T10:00:00' }] as unknown as Task[];
        const csv = exportCsv({
            habits,
            completions: [{ habitId: 'h', date: '2026-11-03', value: 5, skipped: false }, { habitId: 'gone', date: '2026-11-01', value: 1, skipped: true }],
            tasks,
            focus: [{ itemId: 't', startedAt: '2026-11-02T09:00:00', date: '2026-11-02', seconds: 1500, completed: true, mode: 'focus' }],
        });
        expect(csv.split('\n')).toEqual([
            'date,type,name,status,amount,unit,minutes',
            '2026-11-01,habit,Deleted habit,skipped,,,',
            '2026-11-02,task,Send proposal,done,,,',
            '2026-11-02,focus,Send proposal,finished,,,25',
            '2026-11-03,habit,Run,done,5,km,',
        ]);
    });
});
