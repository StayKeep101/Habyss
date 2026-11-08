import AsyncStorage from '@react-native-async-storage/async-storage';

const mockDb = {
    getAllAsync: jest.fn(async () => [{ habit_id: 'h1', date: '2026-10-20', value: 12, updated_at: '2026-10-20T10:00:00Z' }]),
    runAsync: jest.fn(async (..._args: unknown[]) => ({ changes: 1 })),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
};
const mockServer = { row: null as null | { data: any }, error: null as null | { message: string }, upserts: [] as any[] };
jest.mock('../database', () => ({ getDatabase: jest.fn(async () => mockDb) }));
jest.mock('../supabase', () => ({
    getSupabase: () => ({
        from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockServer.row, error: mockServer.error }) }) }),
            upsert: async (row: any) => { mockServer.upserts.push(row); return { error: null }; },
        }),
    }),
}));

import { applyPersonal, backUpPersonal, clearPersonal, collectPersonal, restorePersonal, syncPersonal, takeRestored } from '../personalBackup';

const ME = 'account-1';

beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockServer.row = null;
    mockServer.error = null;
    mockServer.upserts = [];
    takeRestored();
});

describe('what goes in the personal backup', () => {
    it('takes personal stores and recent partial progress, never device-only keys', async () => {
        await AsyncStorage.multiSet([
            ['habyss_echo_memory', '["likes mornings"]'],
            ['focus_session_2026-10-20', '{"minutes":50}'],
            ['habyss_local_user_id', ME],
            ['cloud_pull_cursor_account-1', '2026-10-20'],
            ['habyss_calendar_hidden', '["cal-1"]'],
            ['habyss_calendar_on', '1'],
            ['habyss_health_connected', '1'],
        ]);
        const doc = await collectPersonal(ME);
        // Integrations you switched on come back after signing in again.
        expect(Object.keys(doc.stores).sort()).toEqual(['focus_session_2026-10-20', 'habyss_calendar_on', 'habyss_echo_memory', 'habyss_health_connected']);
        expect(doc.measurements).toHaveLength(1);
    });
});

describe('restoring', () => {
    it('puts the stores back and adds partial progress without overwriting', async () => {
        const written = await applyPersonal({ version: 1, stores: { habyss_sleep_log: '[1]' }, measurements: [{ habit_id: 'h1', date: '2026-10-20', value: 3, updated_at: 'x' }] }, ME);
        expect(await AsyncStorage.getItem('habyss_sleep_log')).toBe('[1]');
        expect(mockDb.runAsync.mock.calls[0][0]).toContain('INSERT OR IGNORE INTO habit_measurements');
        expect(written).toBe(2);
    });

    it('ignores keys a backup should never have carried', async () => {
        await applyPersonal({ version: 1, stores: { habyss_local_user_id: 'someone-else' } }, ME);
        expect(await AsyncStorage.getItem('habyss_local_user_id')).toBeNull();
    });

    it('restores once per account on this phone, and counts what it wrote', async () => {
        mockServer.row = { data: { version: 1, stores: { habyss_check_ins: '[]' } } };
        expect(await restorePersonal(ME)).toBe(1);
        expect(await restorePersonal(ME)).toBe(0);
        expect(takeRestored()).toBe(1);
    });

    it('does not claim the phone when the backup could not be read', async () => {
        mockServer.error = { message: 'network down' };
        await expect(restorePersonal(ME)).rejects.toBeTruthy();
        expect(await backUpPersonal(ME)).toBe(false);
        expect(mockServer.upserts).toHaveLength(0);
    });
});

describe('backing up', () => {
    it('never uploads a phone\'s stores before the account\'s backup was read', async () => {
        await AsyncStorage.setItem('app_settings', '{"fresh":true}');
        expect(await backUpPersonal(ME)).toBe(false);
        expect(mockServer.upserts).toHaveLength(0);
    });

    it('restores first, then backs up on later syncs, and skips an unchanged document', async () => {
        await AsyncStorage.setItem('app_settings', '{"theme":"dark"}');
        await syncPersonal(ME); // no backup yet: claims the phone
        await syncPersonal(ME);
        await syncPersonal(ME);
        expect(mockServer.upserts).toHaveLength(1);
        expect(mockServer.upserts[0].data.stores.app_settings).toBe('{"theme":"dark"}');
    });
});

describe('a different account taking over the phone', () => {
    it('clears the personal stores and the claim', async () => {
        await AsyncStorage.multiSet([['habyss_echo_memory', '[]'], ['habyss_personal_backup_owner', ME], ['habyss_shared_people', '[]'], ['habyss_local_user_id', ME]]);
        await clearPersonal();
        expect(await AsyncStorage.getAllKeys()).toEqual(['habyss_local_user_id']);
    });
});
