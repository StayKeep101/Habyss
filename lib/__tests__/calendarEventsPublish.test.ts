import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventsFor, publishEvents } from '../calendarEvents';
import { PUBLISHED_EVENTS_KEY } from '../dayInputsSync';

jest.mock('../dayInputsSync', () => ({ ...jest.requireActual('../dayInputsSync'), markDayInputsDirty: jest.fn() }));
const { markDayInputsDirty } = jest.requireMock('../dayInputsSync') as { markDayInputsDirty: jest.Mock };

const slot = { id: 'E1', title: 'School', start: 600, minutes: 60 };
const published = async () => JSON.parse((await AsyncStorage.getItem(PUBLISHED_EVENTS_KEY)) ?? '{}');

describe('publishing the calendar for the desktop', () => {
    beforeEach(async () => { await AsyncStorage.clear(); markDayInputsDirty.mockClear(); });

    it('publishes a day once, and again only when it changes', async () => {
        const day = '2026-11-26';
        expect(await publishEvents(day, [slot], day)).toBe(true);
        expect(await publishEvents(day, [slot], day)).toBe(false);
        expect(markDayInputsDirty).toHaveBeenCalledTimes(1);
        expect(await publishEvents(day, [{ ...slot, start: 630 }], day)).toBe(true);
        expect((await published())[day]).toEqual([{ ...slot, start: 630 }]);
    });

    it('keeps only yesterday to a week ahead', async () => {
        await publishEvents('2026-11-20', [slot], '2026-11-20');
        await publishEvents('2026-12-03', [slot], '2026-11-26');
        await publishEvents('2026-12-04', [slot], '2026-11-26');
        expect(Object.keys(await published()).sort()).toEqual(['2026-12-03']);
    });

    it('publishes an empty day when the calendar is off', async () => {
        await AsyncStorage.setItem('habyss_calendar_on', '0');
        const today = (require('../habitSchedule') as typeof import('../habitSchedule')).localDateKey(new Date());
        await publishEvents(today, [slot], today);
        expect(await eventsFor(today, true)).toEqual([]);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect((await published())[today]).toEqual([]);
    });
});
