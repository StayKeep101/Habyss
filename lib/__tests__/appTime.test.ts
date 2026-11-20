import { NativeModules } from 'react-native';

jest.mock('../autoTrack', () => ({ autoTickHabit: jest.fn().mockResolvedValue({ result: 'done' }) }));

describe('app-time habits', () => {
    const { autoTickHabit } = require('../autoTrack');
    beforeEach(() => {
        jest.clearAllMocks();
        (NativeModules as any).ScreenTimeModule = {
            pickAppTimeApps: jest.fn(),
            takeAppTimeResults: jest.fn().mockResolvedValue(['read|2026-11-19|done', 'social|2026-11-19|kept', 'games|2026-11-19|over', 'bad line']),
        };
    });

    it('ticks what was reached or kept, never what went over', async () => {
        const { drainAppTime } = require('../appTime');
        expect(await drainAppTime()).toBe(2);
        expect(autoTickHabit).toHaveBeenCalledWith('read', '2026-11-19');
        expect(autoTickHabit).toHaveBeenCalledWith('social', '2026-11-19');
        expect(autoTickHabit).not.toHaveBeenCalledWith('games', expect.anything());
    });

    it('does nothing on a build without it', async () => {
        (NativeModules as any).ScreenTimeModule = {};
        const { drainAppTime, appTimeSupported } = require('../appTime');
        expect(appTimeSupported()).toBe(false);
        expect(await drainAppTime()).toBe(0);
    });
});
