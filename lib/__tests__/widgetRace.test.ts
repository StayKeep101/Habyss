import { initialsOf, widgetRace } from '../widgetRace';

const racer = (id: string, marks: number, extra = {}) => ({ id, name: `${id} Person`, marks, series: Array.from({ length: 40 }, (_, i) => i * marks / 40), ...extra });

describe('the race on the Friends widget', () => {
    it('is Community’s race: you and your top friends, with everyone’s real rank', () => {
        const race = widgetRace([racer('a', 500), racer('b', 400), racer('me', 300, { me: true }), racer('c', 200), racer('d', 100), racer('e', 50)]);
        expect(race.racers.map(r => r.id)).toEqual(['a', 'b', 'c', 'd', 'me']);
        expect(race.racers.find(r => r.me)?.rank).toBe(3);
    });
    it('keeps a month of each line, and a face with no history still gets its total', () => {
        const race = widgetRace([racer('me', 300, { me: true }), { id: 'new', name: 'New', marks: 20 }]);
        expect(race.racers.find(r => r.me)?.series).toHaveLength(30);
        expect(race.racers.find(r => r.id === 'new')?.series).toEqual([20]);
    });
    it('initials from the name', () => {
        expect(initialsOf('Erwan Peter')).toBe('EP');
        expect(initialsOf('  ')).toBe('?');
    });
});
