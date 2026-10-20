import { toSlot } from '../calendarEvents';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

describe('calendar events as timeline blocks', () => {
    const day = '2026-10-20';
    it('turns an event into minutes of that day, clipped to it', () => {
        expect(toSlot({ id: 'a', title: 'Standup', startDate: `${day}T09:30:00`, endDate: `${day}T10:00:00` }, day))
            .toEqual({ id: 'a', title: 'Standup', start: 570, minutes: 30, color: undefined });
        // Started the night before: only the part inside this day.
        expect(toSlot({ id: 'b', title: 'Flight', startDate: '2026-10-19T22:00:00', endDate: `${day}T02:00:00` }, day)?.start).toBe(0);
    });
    it('does not block time for all-day, free or cancelled events', () => {
        const base = { id: 'c', title: 'x', startDate: `${day}T09:00:00`, endDate: `${day}T10:00:00` };
        expect(toSlot({ ...base, allDay: true }, day)).toBeNull();
        expect(toSlot({ ...base, availability: 'free' }, day)).toBeNull();
        expect(toSlot({ ...base, status: 'canceled' }, day)).toBeNull();
        expect(toSlot({ ...base, title: '  ' }, day)?.title).toBe('Busy');
    });
});
