import { searchPlaces, tidyPlaces } from '../placeSearch';

jest.mock('@/modules/habyss-live-activity', () => ({ __esModule: true, default: null }));
jest.mock('expo-location', () => ({
    geocodeAsync: jest.fn(async () => [{ latitude: 45.4, longitude: -75.65 }]),
    reverseGeocodeAsync: jest.fn(async () => [{ name: 'The Ottawa Hospital', streetNumber: '501', street: 'Smyth Rd', city: 'Ottawa' }]),
}));

describe('tidyPlaces', () => {
    it('drops repeats, empty names and an address that only repeats the name', () => {
        const out = tidyPlaces([
            { name: 'Gym', address: 'Gym', latitude: 1, longitude: 1 },
            { name: 'Gym', address: '', latitude: 1.0001, longitude: 1.0001 },
            { name: ' ', address: '', latitude: 2, longitude: 2 },
            { name: 'Gym', address: '9 Main St', latitude: 3, longitude: 3 },
            { name: 'Bad', address: '', latitude: NaN, longitude: 0 },
        ]);
        expect(out).toEqual([
            { name: 'Gym', address: '', latitude: 1, longitude: 1 },
            { name: 'Gym', address: '9 Main St', latitude: 3, longitude: 3 },
        ]);
    });
});

describe('searchPlaces', () => {
    it('says nothing for a letter', async () => {
        expect(await searchPlaces('a', null)).toEqual([]);
    });
    it('falls back to the address search, named by what is there', async () => {
        expect(await searchPlaces('ottawa hospital', null)).toEqual([
            { name: 'The Ottawa Hospital', address: '501 Smyth Rd, Ottawa', latitude: 45.4, longitude: -75.65 },
        ]);
    });
});
