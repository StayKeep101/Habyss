import { describeAlerts, loadItemAlerts, parseAlerts, storeAlerts } from '../itemAlerts';
import { mutedTypes, PUSH_KINDS } from '../pushPrefs';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

describe('reminders before it begins', () => {
    it('keeps whole positive minutes, each once, from JSON or a list', () => {
        expect(parseAlerts('[10, 30, 10, -5, "x"]')).toEqual([30, 10]);
        expect(parseAlerts([5.4])).toEqual([5]);
        expect(parseAlerts('nope')).toBeUndefined();
        expect(parseAlerts([])).toBeUndefined();
        expect(storeAlerts([10, 60])).toBe('[60,10]');
        expect(storeAlerts([])).toBeNull();
    });
    it('a habit’s older single "minutes before" still counts; its own list wins', async () => {
        expect(await loadItemAlerts([{ id: 'a', reminderOffset: 15 }, { id: 'b', reminderOffset: 15, alerts: [5] }], [{ id: 't', alerts: [10] }]))
            .toEqual({ a: [15], b: [5], t: [10] });
    });
    it('says it plainly', () => {
        expect(describeAlerts(undefined)).toBe('At the start');
        expect(describeAlerts([10])).toBe('10 min before');
        expect(describeAlerts([10, 60])).toBe('1 hr and 10 min before');
    });
});

describe('community notifications', () => {
    it('a kind switched off keeps every one of its types to the inbox, and nothing else', () => {
        expect(mutedTypes(new Set(['games']))).toEqual(['duel', 'challenge', 'market']);
        expect(mutedTypes(new Set())).toEqual([]);
        const all = PUSH_KINDS.flatMap(kind => kind.types);
        expect(new Set(all).size).toBe(all.length);
    });
});
