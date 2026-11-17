jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { atPlace, metresBetween, proofRule } from '../challengeProof';

const habit = (extra: Record<string, unknown> = {}) => ({ kind: 'habit' as const, habit: { id: 'h', name: 'Gym', goalId: undefined, ...extra } as never });
const task = (goalId?: string) => ({ kind: 'task' as const, task: { id: 't', title: 'Plan', goalId } });

describe('what a tick by hand needs', () => {
    it('nothing, outside challenges and bets', () => {
        expect(proofRule(habit(), null, [])).toBe('none');
        expect(proofRule(task('g1'), null, ['g2'])).toBe('none');
    });

    it('what the challenge says, for a challenge item', () => {
        expect(proofRule(habit(), 'photo', [])).toBe('photo');
        expect(proofRule(habit(), 'health', [])).toBe('health');
        expect(proofRule(task(), 'focus', [])).toBe('focus');
    });

    it('on a goal open to bets: Health and the timer track their own, the rest a photo', () => {
        expect(proofRule(habit({ goalId: 'g1', healthKitMetric: 'steps' }), null, ['g1'])).toBe('health');
        expect(proofRule(habit({ goalId: 'g1', unit: 'minutes' }), null, ['g1'])).toBe('focus');
        expect(proofRule(habit({ goalId: 'g1' }), null, ['g1'])).toBe('photo');
        expect(proofRule(task('g1'), null, ['g1'])).toBe('photo');
    });
});

describe('being at the place', () => {
    const gym = { latitude: 48.8566, longitude: 2.3522 };
    it('measures metres between two points', () => {
        expect(Math.round(metresBetween(gym, { latitude: 48.8575, longitude: 2.3522 }))).toBe(100);
    });
    it('counts within the place, with room for GPS drift', () => {
        expect(atPlace({ latitude: 48.8575, longitude: 2.3522 }, [gym])).toBe(true);
        expect(atPlace({ latitude: 48.8666, longitude: 2.3522 }, [gym])).toBe(false);
        expect(atPlace({ latitude: 48.8666, longitude: 2.3522 }, [{ ...gym, radius: 2000 }])).toBe(true);
    });
});
