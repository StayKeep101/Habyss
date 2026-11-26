import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentTravel, scopeOf, setTravel, travelOf, weekdayKey } from '../eventTravel';

// 2026-11-10 is a Tuesday, 2026-11-12 a Thursday, 2026-11-17 the next Tuesday.
const TUE = '2026-11-10', THU = '2026-11-12', NEXT_TUE = '2026-11-17';
let title = 'Class';
const classOn = (id: string) => ({ id, title });

describe('event travel reaches', () => {
    // The store is kept in memory between tests: each test has its own class.
    let n = 0;
    beforeEach(async () => { await AsyncStorage.clear(); title = `Class ${++n}`; });

    it('keeps the same class apart by weekday: Tuesday has a walk, Thursday none', async () => {
        await setTravel(classOn('a'), { before: 20, after: 20 }, { day: TUE, reach: 'weekday' });
        await setTravel(classOn('b'), { before: 0, after: 0 }, { day: THU, reach: 'weekday' });
        const all = currentTravel();
        expect(travelOf(all, classOn('c'), NEXT_TUE)).toMatchObject({ before: 20, after: 20 });
        expect(travelOf(all, classOn('d'), THU)).toMatchObject({ before: 0, after: 0 });
        expect(scopeOf(all, classOn('c'), NEXT_TUE)).toBe('weekday');
        expect(all[weekdayKey(title, TUE)]).toBeDefined();
    });

    it('lets the narrowest reach win: this day, then the weekday, then the name', async () => {
        await setTravel(classOn('a'), { before: 10, after: 10 }, { day: TUE, reach: 'every' });
        await setTravel(classOn('a'), { before: 30, after: 30 }, { day: TUE, reach: 'weekday' });
        await setTravel(classOn('a'), { before: 45, after: 0 }, { day: TUE, reach: 'once' });
        const all = currentTravel();
        expect(travelOf(all, classOn('a'), TUE)?.before).toBe(45);
        expect(travelOf(all, classOn('z'), NEXT_TUE)?.before).toBe(30);
        expect(travelOf(all, classOn('z'), THU)?.before).toBe(10);
    });

    it('setting every one on a day replaces that weekday’s own, and keeps other weekdays’', async () => {
        await setTravel(classOn('a'), { before: 30, after: 30 }, { day: TUE, reach: 'weekday' });
        await setTravel(classOn('b'), { before: 5, after: 5 }, { day: THU, reach: 'weekday' });
        await setTravel(classOn('a'), { before: 15, after: 15 }, { day: TUE, reach: 'every' });
        const all = currentTravel();
        expect(scopeOf(all, classOn('a'), TUE)).toBe('every');
        expect(travelOf(all, classOn('a'), TUE)?.before).toBe(15);
        expect(travelOf(all, classOn('b'), THU)?.before).toBe(5);
    });
});
