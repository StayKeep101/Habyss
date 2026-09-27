import { healthLabel, mergeHealth, metricFits, metricsForUnit, readHealth } from '../healthMetrics';

jest.mock('../HealthKitService', () => ({
    HealthKitService: {
        isAvailable: true,
        init: jest.fn().mockResolvedValue(true),
        getSteps: jest.fn().mockResolvedValue(8412.6),
        getSleep: jest.fn().mockResolvedValue(430),
        getMindfulness: jest.fn().mockResolvedValue(12),
        getWorkout: jest.fn().mockResolvedValue(45),
    },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const service = () => (require('../HealthKitService') as typeof import('../HealthKitService')).HealthKitService;

describe('which metrics can answer for a unit', () => {
    it('answers a step habit with steps', () => {
        expect(metricsForUnit('steps')).toEqual(['steps']);
        expect(metricsForUnit('step')).toEqual(['steps']);
    });

    it('offers the three measured in minutes to anything counted in time', () => {
        expect(metricsForUnit('minutes')).toEqual(['sleep', 'mindfulness', 'workout']);
        expect(metricsForUnit('hours')).toEqual(['sleep', 'mindfulness', 'workout']);
    });

    it('offers nothing where a number would look like an answer', () => {
        // A step count filling in "8 glasses" is worse than no help at all.
        expect(metricsForUnit('glasses')).toEqual([]);
        expect(metricsForUnit('pages')).toEqual([]);
        expect(metricsForUnit('')).toEqual([]);
        expect(metricsForUnit(undefined)).toEqual([]);
    });

    it('knows when a link has stopped making sense', () => {
        expect(metricFits('minutes', 'sleep')).toBe(true);
        expect(metricFits('pages', 'sleep')).toBe(false);
    });

    it('names each one', () => {
        expect(healthLabel('mindfulness')).toBe('Mindful');
    });
});

describe('reading today', () => {
    it('rounds what Health gives back', async () => {
        await expect(readHealth('steps')).resolves.toBe(8413);
        await expect(readHealth('workout')).resolves.toBe(45);
    });

    it('returns null rather than zero when Health will not answer', async () => {
        (service().init as jest.Mock).mockResolvedValueOnce(false);
        await expect(readHealth('steps')).resolves.toBeNull();
    });

    it('returns null rather than throwing when a read fails', async () => {
        (service().getSteps as jest.Mock).mockRejectedValueOnce(new Error('denied'));
        await expect(readHealth('steps')).resolves.toBeNull();
    });
});

describe('merging with what is already logged', () => {
    it('takes Health as a floor, never a ceiling', () => {
        expect(mergeHealth(0, 8413)).toBe(8413);
        // Walked on a second phone: their number is real and Health cannot see it.
        expect(mergeHealth(12000, 8413)).toBe(12000);
    });

    it('leaves the stored number alone when Health did not answer', () => {
        expect(mergeHealth(30, null)).toBe(30);
    });
});
