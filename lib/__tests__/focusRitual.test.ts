jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
import { focusExitFull, takeFocusRitual } from '../focusRitual';

describe('the focus ritual', () => {
    it('plays in full for the first session of a day only, and leaving matches the way in', () => {
        expect(takeFocusRitual('2026-11-05')).toBe(true);
        expect(focusExitFull()).toBe(true);
        expect(takeFocusRitual('2026-11-05')).toBe(false);
        expect(focusExitFull()).toBe(false);
        expect(takeFocusRitual('2026-11-06')).toBe(true);
    });
});
