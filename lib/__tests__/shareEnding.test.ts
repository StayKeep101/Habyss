import AsyncStorage from '@react-native-async-storage/async-storage';

const mockCalls: { sql: string; args: unknown[] }[] = [];
const mockAlive = new Set(['habit-ended', 'habit-kept']);
jest.mock('../database', () => ({
    generateId: () => 'fresh-id',
    getDatabase: async () => ({
        getFirstAsync: async (_sql: string, id: string) => (mockAlive.has(id) ? { id } : null),
        runAsync: async (sql: string, ...args: unknown[]) => { mockCalls.push({ sql, args }); },
        withTransactionAsync: async (run: () => Promise<void>) => run(),
    }),
}));
const mockCloseShares = jest.fn(async () => true);
jest.mock('../friendsService', () => ({ FriendsService: { closeShares: (...args: unknown[]) => mockCloseShares(...(args as [])) } }));

import { endShares, flushShareEndings, isAdopted, keepEndedCopies, rememberAdopted } from '../shareEnding';

beforeEach(async () => { mockCalls.length = 0; mockCloseShares.mockClear(); await AsyncStorage.clear(); });

describe('when a share ends', () => {
    it('the copy left behind becomes yours: a new id, its ticks moved with it', async () => {
        await rememberAdopted('habit', 'habit-ended');
        await rememberAdopted('habit', 'habit-kept');
        const moved = await keepEndedCopies({ habit: ['habit-kept'], task: [] }, 'me');
        expect(moved).toEqual({ 'habit-ended': 'fresh-id' });
        expect(mockCalls.some(call => call.sql.startsWith('UPDATE habits SET id = ?') && call.args[0] === 'fresh-id' && call.args[3] === 'habit-ended')).toBe(true);
        expect(mockCalls.some(call => call.sql.startsWith('UPDATE completions SET habit_id = ?'))).toBe(true);
        expect(await isAdopted('habit', 'habit-ended')).toBe(false);
        expect(await isAdopted('habit', 'habit-kept')).toBe(true);
    });
    it('a share that could not be closed offline is sent later', async () => {
        mockCloseShares.mockResolvedValueOnce(false);
        await endShares('task', 'task-1');
        expect(await flushShareEndings()).toBe(true);
        expect(mockCloseShares).toHaveBeenLastCalledWith('task', 'task-1');
    });
});
