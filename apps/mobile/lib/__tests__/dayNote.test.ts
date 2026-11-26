import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayNote, loadDayNotes, setDayNote, shouldAskDayNote, skipDayNote } from '../dayNote';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('the note on your day', () => {
    beforeAll(async () => { await AsyncStorage.clear(); await loadDayNotes(); });
    const at = (h: number, m = 0) => new Date(2026, 10, 22, h, m);

    it('asks only once your day is up', () => {
        expect(shouldAskDayNote('21:00', at(20, 59), '2026-11-22')).toBe(false);
        expect(shouldAskDayNote('21:00', at(21, 0), '2026-11-22')).toBe(true);
        expect(shouldAskDayNote(null, at(23), '2026-11-22')).toBe(false);
    });

    it('stops asking once written, or put away for the day', async () => {
        await setDayNote('2026-11-22', '  Long day.  ');
        expect(dayNote('2026-11-22')).toBe('Long day.');
        expect(shouldAskDayNote('21:00', at(22), '2026-11-22')).toBe(false);
        await skipDayNote('2026-11-23');
        expect(shouldAskDayNote('21:00', new Date(2026, 10, 23, 22), '2026-11-23')).toBe(false);
        expect(shouldAskDayNote('21:00', new Date(2026, 10, 24, 22), '2026-11-24')).toBe(true);
    });
});
