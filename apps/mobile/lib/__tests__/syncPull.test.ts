const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (k: string) => store[k] ?? null), setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }), removeItem: jest.fn(async () => undefined),
}));
jest.mock('../database', () => ({ getDatabase: jest.fn(async () => null), isSQLiteAvailable: () => false }));
jest.mock('../supabase', () => ({ getSupabase: () => null }));

/** One request fetches every table's changes (supabase/migrations/20261126000300_sync_pull.sql). */
describe('pulling every table in one request', () => {
    beforeEach(() => { jest.resetModules(); for (const k of Object.keys(store)) delete store[k]; });

    it('asks once, from each table’s own cursor', async () => {
        const { firstPages } = require('../cloudSync') as typeof import('../cloudSync');
        store['cloud_pull_v2_u1_tasks'] = '2026-11-26T08:00:00.000Z';
        const sb = { rpc: jest.fn(async () => ({ data: { habits: [{ id: 'h' }], tasks: [], habit_completions: [] }, error: null })) };
        const pages = await firstPages(sb, 'u1');
        expect(sb.rpc).toHaveBeenCalledTimes(1);
        expect(sb.rpc).toHaveBeenCalledWith('sync_pull', { p_since: { tasks: '2026-11-26T08:00:00.000Z' }, p_limit: expect.any(Number) });
        expect(pages?.habits).toEqual([{ id: 'h' }]);
    });

    it('a server without it is asked table by table for the rest of the session', async () => {
        const { firstPages } = require('../cloudSync') as typeof import('../cloudSync');
        const sb = { rpc: jest.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'not found' } })) };
        expect(await firstPages(sb, 'u1')).toBeNull();
        expect(await firstPages(sb, 'u1')).toBeNull();
        expect(sb.rpc).toHaveBeenCalledTimes(1);
    });
});
