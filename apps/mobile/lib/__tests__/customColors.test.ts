jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { CUSTOM_COLOR_LIMIT, canKeepColor, saveCustomColor, currentCustomColors, withColor } from '../customColors';

const six = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'];

describe('custom colours', () => {
    it('keeps six at most', () => {
        expect(CUSTOM_COLOR_LIMIT).toBe(6);
        expect(canKeepColor(six.slice(0, 5), '#777777')).toBe(true);
        expect(canKeepColor(six, '#777777')).toBe(false);
    });
    it('a colour already kept can be kept again (it moves to the front)', () => {
        expect(canKeepColor(six, '#333333')).toBe(true);
        expect(withColor(six, '#333333')[0]).toBe('#333333');
    });
    it('refuses a seventh instead of dropping the oldest', async () => {
        for (const color of six) await saveCustomColor(color);
        expect(await saveCustomColor('#777777')).toBe(false);
        expect(currentCustomColors()).toHaveLength(6);
        expect(currentCustomColors()).toContain('#111111');
    });
});
