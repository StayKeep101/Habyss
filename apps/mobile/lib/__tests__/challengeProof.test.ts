jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { atPlace, metresBetween, proofRule } from '../challengeProof';

describe('what a tick by hand needs', () => {
    it('nothing, outside challenges', () => {
        expect(proofRule(null)).toBe('none');
        expect(proofRule('tick')).toBe('none');
    });

    it('what the challenge says, for a challenge item', () => {
        expect(proofRule('photo')).toBe('photo');
        expect(proofRule('health')).toBe('health');
        expect(proofRule('focus')).toBe('focus');
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
