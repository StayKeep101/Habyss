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

describe('which metrics can answer for a unit', () => {
    it('answers a step habit with steps, and nothing else', () => {
        // A step is a count of strides, not a distance, so it must never be
        // offered against a habit measured in metres — or the other way round.
        expect(metricsForUnit('steps')).toEqual(['steps']);
        expect(metricsForUnit('km')).not.toContain('steps');
    });

    it('offers everything measured in time to a habit counted in time', () => {
        expect(metricsForUnit('minutes')).toEqual(expect.arrayContaining(['sleep', 'mindfulness', 'exercise', 'workout']));
        expect(metricsForUnit('hours')).toEqual(metricsForUnit('minutes'));
    });

    it('offers distance in whatever the habit is measured in', () => {
        expect(metricsForUnit('miles')).toEqual(expect.arrayContaining(['walkRun', 'cycling']));
        expect(metricsForUnit('m')).toEqual(expect.arrayContaining(['swimming']));
    });

    it('offers nothing where a number would look like an answer', () => {
        expect(metricsForUnit('pages')).toEqual([]);
        expect(metricsForUnit('')).toEqual([]);
        expect(metricsForUnit(undefined)).toEqual([]);
    });

    it('knows when a link has stopped making sense', () => {
        expect(metricFits('minutes', 'sleep')).toBe(true);
        expect(metricFits('pages', 'sleep')).toBe(false);
    });

    it('names each one', () => {
        expect(healthLabel('mindfulness')).toBe('Mindful minutes');
        expect(HEALTH_METRICS.length).toBeGreaterThan(10);
    });

    it('recognises only the metrics this build knows', () => {
        expect(isHealthMetric('steps')).toBe(true);
        expect(isHealthMetric('vitamin_k')).toBe(false);
        expect(isHealthMetric(undefined)).toBe(false);
    });
});

describe('putting a reading into the habit’s own unit', () => {
    // The thing that would otherwise be silently, enormously wrong: a habit of
    // eight hours' sleep filled in from a reading in minutes reads as 450.
    it('converts time', () => {
        expect(inHabitUnit(450, 'sleep', 'hours')).toBe(7.5);
        expect(inHabitUnit(450, 'sleep', 'minutes')).toBe(450);
    });

    it('converts volume, including a glass', () => {
        expect(inHabitUnit(2000, 'water', 'glasses')).toBe(8);
        expect(inHabitUnit(2000, 'water', 'l')).toBe(2);
    });

    it('converts distance', () => {
        expect(inHabitUnit(5, 'walkRun', 'miles')).toBeCloseTo(3.107, 2);
        expect(inHabitUnit(1000, 'swimming', 'km')).toBe(1);
    });

    it('refuses rather than guessing when the units do not convert', () => {
        expect(inHabitUnit(8000, 'steps', 'km')).toBeNull();
        expect(inHabitUnit(100, 'protein', 'pages')).toBeNull();
    });
});

describe('reading today', () => {
    it('rounds what Health gives back', async () => {
        await expect(readHealth('steps')).resolves.toBe(8412.6);
    });

    it('returns null rather than zero when Health will not answer', async () => {
        (service().init as jest.Mock).mockResolvedValueOnce(false);
        await expect(readHealth('steps')).resolves.toBeNull();
    });

    it('returns null rather than zero when the metric has no reading', async () => {
        (service().read as jest.Mock).mockResolvedValueOnce(null);
        await expect(readHealth('sleep')).resolves.toBeNull();
    });

    it('returns null rather than throwing when a read fails', async () => {
        (service().read as jest.Mock).mockRejectedValueOnce(new Error('denied'));
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
