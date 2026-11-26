jest.mock('../HealthKitService', () => ({
    HealthKitService: { isAvailable: true, authorised: jest.fn(async () => true), read: jest.fn(async () => 480), sleepNight: jest.fn(async () => null) },
}));

// Required after each reset, so the test and sleepLog share one store.
const storage = () => (m => m.default ?? m)(require('@react-native-async-storage/async-storage'));

describe('sleep from Health', () => {
    beforeEach(async () => {
        jest.resetModules();
        await storage().clear();
        jest.useFakeTimers().setSystemTime(new Date('2026-10-27T12:00:00'));
    });
    afterEach(() => jest.useRealTimers());

    it('counts only from the day Health was connected, not the nights Health already had', async () => {
        const { refreshSleep, currentSleep } = require('../sleepLog') as typeof import('../sleepLog');
        await refreshSleep();
        expect(currentSleep().since).toBe('2026-10-27');
        expect(Object.keys(currentSleep().nights)).toEqual(['2026-10-27']);
    });

    it('drops nights from before the rule when an old store is read', async () => {
        await storage().setItem('habyss_sleep_log', JSON.stringify({ nights: { '2026-10-13': 300, '2026-10-20': 420 }, target: 420, connected: true }));
        const { refreshSleep, currentSleep } = require('../sleepLog') as typeof import('../sleepLog');
        await refreshSleep();
        expect(Object.keys(currentSleep().nights)).toEqual(['2026-10-27']);
    });

    it('keeps every night from its start on', async () => {
        await storage().setItem('habyss_sleep_log', JSON.stringify({ nights: { '2026-10-20': 300 }, target: 420, connected: true, since: '2026-10-20' }));
        const { refreshSleep, currentSleep } = require('../sleepLog') as typeof import('../sleepLog');
        await refreshSleep();
        expect(Object.keys(currentSleep().nights).sort()[0]).toBe('2026-10-20');
        expect(Object.keys(currentSleep().nights)).toHaveLength(8);
    });
});
