jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
import { autoTrackOptions, trackMinutes } from '../autoTrackSources';

const kinds = (name: string, said?: Parameters<typeof autoTrackOptions>[1]) => autoTrackOptions(name, said).map(option => option.kind);

describe('autoTrackOptions', () => {
    it('reads in reading apps, for as long as it says', () => {
        const [first] = autoTrackOptions('Read', { amount: 30, unit: 'min' });
        expect(first.kind).toBe('app');
        expect(first.label).toContain('Libby');
        expect(trackMinutes(first, { amount: 30, unit: 'min' })).toBe(30);
        expect(first.detail).toBe('Ticks itself after 30 min in them');
    });

    it('takes the time from how long it lasts', () => {
        const [first] = autoTrackOptions('Read a book', { durationMinutes: 45 });
        expect(trackMinutes(first, { durationMinutes: 45 })).toBe(45);
    });

    it('runs from Health first, naming the apps that save there', () => {
        const [first] = autoTrackOptions('Run 5k');
        expect(first.kind).toBe('health');
        expect(first.detail).toContain('Strava');
    });

    it('gym: Health workouts, or time at the gym', () => {
        expect(kinds('Gym')).toEqual(['health', 'place']);
        expect(autoTrackOptions('Gym')[1].label).toBe('At the gym');
    });

    it('a language in Duolingo', () => {
        expect(kinds('Practice Spanish')).toEqual(['app']);
    });

    it('breaking social media: time in those apps', () => {
        expect(kinds('No social media', { quit: true })).toEqual(['app']);
        expect(kinds('No sugar', { quit: true })).toEqual([]);
    });

    it('nothing for what nothing can count', () => {
        expect(kinds('Call mom')).toEqual([]);
        expect(kinds('')).toEqual([]);
    });

    it('never more than two', () => {
        expect(autoTrackOptions('Swim laps at the pool').length).toBeLessThanOrEqual(2);
    });
});
