import { HEALTH_METRICS, healthLabel, inHabitUnit, isHealthMetric, mergeHealth, metricFits, metricsForUnit, readHealth } from '../healthMetrics';

jest.mock('../HealthKitService', () => ({
    HealthKitService: {
        isAvailable: true,
        init: jest.fn().mockResolvedValue(true),
        read: jest.fn().mockResolvedValue(8412.6),
    },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const service = () => (require('../HealthKitService') as typeof import('../HealthKitService')).HealthKitService;

describe('sleep is the only thing read from Health', () => {
    it('offers sleep to a habit counted in time, and nothing else anywhere', () => {
        expect(metricsForUnit('minutes')).toEqual(['sleep']);
        expect(metricsForUnit('hours')).toEqual(['sleep']);
        expect(metricsForUnit('steps')).toEqual([]);
        expect(metricsForUnit('km')).toEqual([]);
        expect(metricsForUnit('pages')).toEqual([]);
        expect(metricsForUnit('')).toEqual([]);
        expect(metricsForUnit(undefined)).toEqual([]);
    });

    it('knows when a link has stopped making sense', () => {
        expect(metricFits('minutes', 'sleep')).toBe(true);
        expect(metricFits('pages', 'sleep')).toBe(false);
    });

    it('names it, and knows no other metric', () => {
        expect(healthLabel('sleep')).toBe('Sleep');
        expect(HEALTH_METRICS.map(metric => metric.id)).toEqual(['sleep']);
        expect(isHealthMetric('sleep')).toBe(true);
        expect(isHealthMetric('steps')).toBe(false);
        expect(isHealthMetric(undefined)).toBe(false);
    });
});

describe('putting a night into the habit’s own unit', () => {
    // Eight hours' sleep filled in from a reading in minutes would read as 450.
    it('converts time', () => {
        expect(inHabitUnit(450, 'sleep', 'hours')).toBe(7.5);
        expect(inHabitUnit(450, 'sleep', 'minutes')).toBe(450);
    });

    it('refuses rather than guessing when the units do not convert', () => {
        expect(inHabitUnit(450, 'sleep', 'pages')).toBeNull();
    });
});

describe('reading last night', () => {
    it('rounds what Health gives back', async () => {
        (service().read as jest.Mock).mockResolvedValueOnce(452.456);
        await expect(readHealth('sleep')).resolves.toBe(452.46);
    });

    it('returns null rather than zero when Health will not answer', async () => {
        (service().init as jest.Mock).mockResolvedValueOnce(false);
        await expect(readHealth('sleep')).resolves.toBeNull();
    });

    it('returns null rather than zero when there is no reading', async () => {
        (service().read as jest.Mock).mockResolvedValueOnce(null);
        await expect(readHealth('sleep')).resolves.toBeNull();
    });

    it('returns null rather than throwing when a read fails', async () => {
        (service().read as jest.Mock).mockRejectedValueOnce(new Error('denied'));
        await expect(readHealth('sleep')).resolves.toBeNull();
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
