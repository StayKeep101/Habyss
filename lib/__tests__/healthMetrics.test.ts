import { HEALTH_METRICS, WORKOUT_KINDS, healthLabel, inHabitUnit, isHealthMetric, mergeHealth, metricFits, metricsForUnit, readHealth } from '../healthMetrics';

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
        const timed = HEALTH_METRICS.filter(metric => metric.unit === 'minutes').map(metric => metric.id);
        expect(metricsForUnit('minutes')).toEqual(timed);
        expect(metricsForUnit('hours')).toEqual(timed);
        expect(timed).toEqual(expect.arrayContaining(['sleep', 'run', 'badminton', 'strength']));
        expect(metricsForUnit('steps')).toEqual(['steps']);
        // Distance, and the sports that cover ground.
        expect(metricsForUnit('km')).toEqual(['distance', 'run', 'walk', 'hike', 'cycle', 'swim', 'row']);
        expect(metricsForUnit('miles')).toEqual(metricsForUnit('km'));
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
        const ids = HEALTH_METRICS.map(metric => metric.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toEqual(expect.arrayContaining(['sleep', 'steps', 'exercise', 'mindful', 'distance', 'flights', 'energy', 'run', 'badminton', 'row', 'workout']));
        // Every workout names the Health kinds it counts.
        for (const metric of HEALTH_METRICS) if (metric.group === 'sport' || metric.group === 'gym') expect(WORKOUT_KINDS[metric.id]).toBeDefined();
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

describe('a workout counted in the habit’s own terms', () => {
    it('reads a run in km for a habit in km or miles, sessions for one in times, else minutes', () => {
        const { readingUnit } = jest.requireActual('../healthMetrics') as typeof import('../healthMetrics');
        expect(readingUnit('run', 'km')).toBe('km');
        expect(readingUnit('run', 'miles')).toBe('km');
        expect(readingUnit('badminton', 'times')).toBe('times');
        expect(readingUnit('badminton', 'sessions')).toBe('times');
        expect(readingUnit('run', 'minutes')).toBe('minutes');
        expect(readingUnit('run', 'hours')).toBe('minutes');
    });
    it('converts km to miles and keeps sessions as they are', () => {
        expect(inHabitUnit(5, 'run', 'km')).toBe(5);
        expect(inHabitUnit(1.609344, 'run', 'miles')).toBeCloseTo(1, 3);
        expect(inHabitUnit(2, 'badminton', 'sessions')).toBe(2);
        expect(metricFits('times', 'badminton')).toBe(true);
        expect(metricFits('km', 'badminton')).toBe(false);
    });
});
