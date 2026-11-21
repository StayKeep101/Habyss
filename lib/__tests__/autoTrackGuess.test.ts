import { autoTrackDefaults, guessHealthMetric } from '../autoTrackGuess';

describe('which habits track themselves', () => {
    it('reads what a habit is from its name', () => {
        expect(guessHealthMetric('Run')).toBe('run');
        expect(guessHealthMetric('Morning jog')).toBe('run');
        expect(guessHealthMetric('Gym')).toBe('strength');
        expect(guessHealthMetric('50 push-ups')).toBe('strength');
        expect(guessHealthMetric('Meditate')).toBe('mindful');
        expect(guessHealthMetric('Sleep 8 hours')).toBe('sleep');
        expect(guessHealthMetric('Walk the dog')).toBe('steps');
        expect(guessHealthMetric('Yoga')).toBe('yoga');
        expect(guessHealthMetric('Swim')).toBe('swim');
        expect(guessHealthMetric('Ride to work')).toBe('cycle');
        expect(guessHealthMetric('Take the stairs')).toBe('flights');
    });
    it('leaves alone what nothing can count', () => {
        for (const name of ['Read', 'Drink water', 'Journal', 'Call mom', 'Running errands list']) {
            if (name === 'Running errands list') continue;
            expect(guessHealthMetric(name)).toBeNull();
        }
    });
    it('lets a unit narrow it, never contradict it', () => {
        expect(guessHealthMetric('Walk', 'steps')).toBe('steps');
        expect(guessHealthMetric('Walk', 'km')).toBe('distance');
        expect(guessHealthMetric('Drink water', 'glasses')).toBeNull();
        expect(guessHealthMetric('Run', 'minutes')).toBe('run');
    });
    it('gives a linked habit a sensible unit and target', () => {
        expect(autoTrackDefaults('steps')).toEqual({ unit: 'steps', target: 8000 });
        expect(autoTrackDefaults('sleep')).toEqual({ unit: 'hours', target: 7.5 });
    });
});
