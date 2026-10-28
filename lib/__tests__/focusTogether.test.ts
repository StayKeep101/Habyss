import { crewOf, focusRooms, hostOf, leftLabel, namesLine, secondsLeft, togetherId } from '../focusTogether';

const NOW = new Date('2026-10-28T15:00:00Z').getTime();
const inMin = (minutes: number) => new Date(NOW + minutes * 60000).toISOString();

describe('focus together', () => {
    it('names the host in the session id, and reads it back', () => {
        expect(togetherId('alex')).toBe('together:alex');
        expect(hostOf('together:alex')).toBe('alex');
        expect(hostOf('habit-123')).toBeNull();
        expect(hostOf('together:')).toBeNull();
        expect(hostOf(null)).toBeNull();
    });

    it('counts the seconds left, never below zero', () => {
        expect(secondsLeft(inMin(18), NOW)).toBe(18 * 60);
        expect(secondsLeft(inMin(-1), NOW)).toBe(0);
        expect(secondsLeft(null, NOW)).toBe(0);
    });

    it('finds who is in the same session: the host and everyone who joined them', () => {
        const friends = [
            { userId: 'alex', focusUntil: inMin(20), focusWith: null },     // the host
            { userId: 'sam', focusUntil: inMin(20), focusWith: 'alex' },    // joined Alex too
            { userId: 'maya', focusUntil: inMin(30), focusWith: null },     // focusing alone
            { userId: 'jo', focusUntil: inMin(-2), focusWith: 'alex' },     // already finished
        ];
        expect(crewOf(friends, 'me', 'alex', NOW).map(f => f.userId)).toEqual(['alex', 'sam']);
    });

    it('shows a host the friends who joined them', () => {
        const friends = [
            { userId: 'alex', focusUntil: inMin(20), focusWith: 'me' },
            { userId: 'maya', focusUntil: inMin(30), focusWith: null },
        ];
        expect(crewOf(friends, 'me', 'me', NOW).map(f => f.userId)).toEqual(['alex']);
    });

    it('says the names short', () => {
        expect(namesLine(['Alex Kim'])).toBe('Alex');
        expect(namesLine(['Alex', 'Sam'])).toBe('Alex and Sam');
        expect(namesLine(['Alex', 'Sam', 'Maya'])).toBe('Alex, Sam and Maya');
        expect(namesLine(['Alex', 'Sam', 'Maya', 'Jo'])).toBe('Alex, Sam and 2 more');
        expect(namesLine([])).toBe('');
    });

    it('groups friends into one session per host, the most time left first', () => {
        const friends = [
            { userId: 'alex', focusUntil: inMin(20), focusWith: null },
            { userId: 'sam', focusUntil: inMin(20), focusWith: 'alex' },
            { userId: 'maya', focusUntil: inMin(45), focusWith: null },
            { userId: 'kai', focusUntil: inMin(10), focusWith: 'stranger' }, // their host is not your friend
            { userId: 'jo', focusUntil: inMin(0.5), focusWith: null },        // under a minute: not worth joining
        ];
        const rooms = focusRooms(friends, NOW);
        expect(rooms.map(room => room.host.userId)).toEqual(['maya', 'alex', 'kai']);
        expect(rooms[1].with.map(f => f.userId)).toEqual(['sam']);
    });

    it('says how long is left', () => {
        expect(leftLabel(18 * 60)).toBe('18 min left');
        expect(leftLabel(20)).toBe('1 min left');
        expect(leftLabel(65 * 60)).toBe('1 hr 5 min left');
        expect(leftLabel(120 * 60)).toBe('2 hr left');
    });

    it('makes one session of two who linked to each other at once', () => {
        const friends = [
            { userId: 'b', focusUntil: inMin(20), focusWith: 'a' },
            { userId: 'a', focusUntil: inMin(30), focusWith: 'b' },
        ];
        const rooms = focusRooms(friends, NOW);
        expect(rooms.map(room => room.host.userId)).toEqual(['a']);
        expect(rooms[0].with.map(f => f.userId)).toEqual(['b']);
    });
});
