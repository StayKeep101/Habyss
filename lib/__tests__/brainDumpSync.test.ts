import AsyncStorage from '@react-native-async-storage/async-storage';
import { addThought, getThoughts, removeThought, updateThought } from '../brainDump';
import { syncBrainDump } from '../brainDumpSync';

jest.mock('../brainDumpReview', () => ({ syncBrainDumpReview: jest.fn() }));

type Row = { id: string; user_id: string; text: string; created_at: string; updated_at: string; deleted_at: string | null };

/** Just enough of the Supabase client for brain_dump: select/upsert/update with the filters used. */
function fakeServer(rows: Row[] = []) {
    let clock = 1000;
    const stamp = () => new Date(Date.UTC(2026, 10, 20, 0, 0, clock++)).toISOString();
    const builder = (op: 'select' | 'update' | 'upsert', payload?: any) => {
        const filters: ((row: Row) => boolean)[] = [];
        let limit = Infinity;
        const run = async () => {
            if (op === 'upsert') {
                for (const item of payload) {
                    const at = rows.findIndex(row => row.id === item.id && row.user_id === item.user_id);
                    const row = { ...(at >= 0 ? rows[at] : {}), ...item, updated_at: stamp() } as Row;
                    if (at >= 0) rows[at] = row; else rows.push(row);
                }
                return { data: null, error: null };
            }
            const hit = rows.filter(row => filters.every(test => test(row)));
            if (op === 'update') { hit.forEach(row => Object.assign(row, payload, { updated_at: stamp() })); return { data: hit, error: null }; }
            return { data: [...hit].sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, limit).map(row => ({ ...row })), error: null };
        };
        const chain: any = {
            eq: (column: keyof Row, value: any) => { filters.push(row => row[column] === value); return chain; },
            gt: (column: keyof Row, value: any) => { filters.push(row => String(row[column]) > value); return chain; },
            in: (column: keyof Row, values: any[]) => { filters.push(row => values.includes(row[column])); return chain; },
            is: (column: keyof Row, value: null) => { filters.push(row => row[column] === value); return chain; },
            order: () => chain,
            limit: (n: number) => { limit = n; return chain; },
            then: (resolve: any, reject: any) => run().then(resolve, reject),
        };
        return chain;
    };
    const sb = { from: () => ({ select: () => builder('select'), update: (p: any) => builder('update', p), upsert: (p: any) => builder('upsert', p) }) };
    return { sb, rows };
}

const ME = 'user-1';
const remote = (id: string, text: string, extra: Partial<Row> = {}): Row => ({
    id, user_id: ME, text, created_at: '2026-11-19T10:00:00.000Z', updated_at: '2026-11-19T10:00:00.000Z', deleted_at: null, ...extra,
});

describe('brain dump sync', () => {
    beforeEach(() => AsyncStorage.clear());

    it('sends thoughts up and brings an assistant\'s down', async () => {
        const server = fakeServer([remote('ai-1', 'from Claude')]);
        await addThought('from the phone');
        expect(await syncBrainDump(server.sb, ME)).toBe(1);
        expect((await getThoughts()).map(t => t.text).sort()).toEqual(['from Claude', 'from the phone']);
        expect(server.rows.map(r => r.text).sort()).toEqual(['from Claude', 'from the phone']);
    });

    it('removes, rewords and keeps removals in both directions', async () => {
        const server = fakeServer([remote('ai-1', 'call mom'), remote('ai-2', 'buy milk')]);
        await syncBrainDump(server.sb, ME);
        await removeThought('ai-1');
        await updateThought('ai-2', 'buy oat milk');
        await syncBrainDump(server.sb, ME);
        expect(server.rows.find(r => r.id === 'ai-1')!.deleted_at).not.toBeNull();
        expect(server.rows.find(r => r.id === 'ai-2')!.text).toBe('buy oat milk');
        // An assistant removes one: gone from the phone on the next sync.
        server.rows.find(r => r.id === 'ai-2')!.deleted_at = '2026-11-20T01:00:00.000Z';
        server.rows.find(r => r.id === 'ai-2')!.updated_at = '2026-11-20T01:00:00.000Z';
        await syncBrainDump(server.sb, ME);
        expect(await getThoughts()).toEqual([]);
    });

    it('never brings back a thought removed elsewhere, even from an old backup', async () => {
        const server = fakeServer([remote('old', 'stale', { deleted_at: '2026-11-19T11:00:00.000Z', updated_at: '2026-11-19T11:00:00.000Z' })]);
        // A new phone restored the old backup, which still had it.
        await AsyncStorage.setItem('habyss_brain_dump', JSON.stringify([{ id: 'old', text: 'stale', createdAt: '2026-11-19T10:00:00.000Z' }]));
        await syncBrainDump(server.sb, ME);
        expect(await getThoughts()).toEqual([]);
        expect(server.rows.find(r => r.id === 'old')!.deleted_at).not.toBeNull();
    });

    it('does nothing harmful when the server has no table yet', async () => {
        const sb = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }) }) }) }) }) };
        await addThought('kept');
        expect(await syncBrainDump(sb, ME)).toBe(0);
        expect((await getThoughts()).map(t => t.text)).toEqual(['kept']);
    });
});
