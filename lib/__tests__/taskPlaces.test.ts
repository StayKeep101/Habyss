import { loadPlaces, placeChoices, placeOf, recentPlaces, setPlace } from '../taskPlaces';

describe('where a task gets done', () => {
    it('keeps a place per task, puts it first among recent ones, and clears', async () => {
        await loadPlaces();
        await setPlace('t1', ' Library ');
        expect(placeOf('t1')).toBe('Library');
        await setPlace('t2', 'Gym');
        expect(recentPlaces()).toEqual(['Gym', 'Library']);
        await setPlace('t1', null);
        expect(placeOf('t1')).toBeNull();
    });

    it('offers recent places first, then the usual ones, once each', () => {
        expect(placeChoices(['Gym', 'Studio'])).toEqual(['Gym', 'Studio', 'Home', 'Library', 'Office', 'Café']);
    });
});
