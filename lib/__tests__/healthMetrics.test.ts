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

describe('what Health can track by itself', () => {
    it('offers only what measures the habit’s own unit, never a look-alike', () => {
        expect(metricsForUnit('minutes')).toEqual(['sleep', 'exercise', 'mindful']);
        expect(metricsForUnit('hours')).toEqual(['sleep', 'exercise', 'mindful']);
        expect(metricsForUnit('steps')).toEqual(['steps']);
        expect(metricsForUnit('km')).toEqual(['distance']);
        expect(metricsForUnit('kcal')).toEqual(['energy']);
        expect(metricsForUnit('flights')).toEqual(['flights']);
        // A glass of water is not a step: nothing at all rather than a number that looks right.
        expect(metricsForUnit('glasses')).toEqual([]);
        expect(metricsForUnit('pages')).toEqual([]);
        expect(metricsForUnit('')).toEqual([]);
        expect(metricsForUnit(undefined)).toEqual([]);
    });

    it('knows when a link has stopped making sense', () => {
        expect(metricFits('minutes', 'sleep')).toBe(true);
        expect(metricFits('pages', 'sleep')).toBe(false);
        expect(metricFits('km', 'steps')).toBe(false);
    });

    it('names each, and knows no others', () => {
        expect(healthLabel('sleep')).toBe('Sleep');
        expect(HEALTH_METRICS.map(metric => metric.id)).toEqual(['sleep', 'steps', 'exercise', 'mindful', 'distance', 'flights', 'energy']);
        expect(isHealthMetric('steps')).toBe(true);
        expect(isHealthMetric('heartbeat')).toBe(false);
        expect(isHealthMetric(undefined)).toBe(false);
    });
    it('offers each as an automatic habit with its target among the choices', () => {
        for (const metric of HEALTH_METRICS) expect(metric.habit.targets).toContain(metric.habit.target);
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
