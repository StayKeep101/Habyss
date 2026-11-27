import { completionToLocal, completionToRemote, habitToLocal, habitToRemote, taskToLocal, taskToRemote } from '../cloudMapping';

/**
 * The sync contract both apps share (packages/schema): a server row with every column, downloaded and uploaded again,
 * comes back with exactly the columns the contract says to upload. The Mac's mapping (apps/desktop/src-tauri/src/cloud/
 * mapping.rs) has the same test, so the two apps can never disagree on what a habit, task or check-in carries.
 */
const { tables } = require('../../../../packages/schema/src/tables.json') as { tables: Record<string, Record<string, string>> };
const { tables: contract } = require('../../../../packages/schema/src/contract.json') as { tables: Record<string, { notUploaded: Record<string, string> }> };

const sample = (udt: string, column: string): unknown => {
    if (udt === 'uuid') return '00000000-0000-4000-8000-000000000001';
    if (udt === 'date') return '2026-11-26';
    if (udt === 'timestamptz') return '2026-11-26T10:00:00.000Z';
    if (udt.startsWith('int') || udt === 'numeric') return 1;
    if (udt === 'bool') return true;
    if (udt === '_int4') return [10];
    if (udt === 'jsonb') return column === 'anchor' ? { to: 'Lunch', side: 'after' } : column === 'goal_spec' ? {} : [];
    return column === 'status' ? 'open' : /_time$/.test(column) ? '09:00' : 'x';
};
// A live row (not deleted), with every column the server has.
const serverRow = (table: string) => ({ ...Object.fromEntries(Object.entries(tables[table]).map(([c, udt]) => [c, sample(udt, c)])), deleted_at: null });

describe.each([
    ['habits', habitToLocal, habitToRemote],
    ['tasks', taskToLocal, taskToRemote],
    ['habit_completions', completionToLocal, completionToRemote],
] as const)('%s round-trips to the contract', (table, down, up) => {
    const uploaded = Object.keys(up(down(serverRow(table)), '00000000-0000-4000-8000-000000000009')).sort();
    const columns = Object.keys(tables[table]);

    it('uploads only columns the server has', () => {
        expect(uploaded.filter(c => !columns.includes(c))).toEqual([]);
    });
    it('uploads every column the contract does not exclude', () => {
        expect(uploaded).toEqual(columns.filter(c => !(c in contract[table].notUploaded)).sort());
    });
});
