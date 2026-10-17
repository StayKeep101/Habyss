import { DEFAULT_ROADMAP_FILTER, isFiltered, normalizeRoadmapFilter, toggleShown } from '../roadmapFilter';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

describe('the roadmap filter', () => {
    it('can show tasks and habits without goals', () => {
        const shown = toggleShown(DEFAULT_ROADMAP_FILTER.shown, 'goals');
        expect(shown).toEqual({ goals: false, habits: true, tasks: true });
    });

    it('never hides everything', () => {
        let shown = toggleShown(DEFAULT_ROADMAP_FILTER.shown, 'goals');
        shown = toggleShown(shown, 'habits');
        expect(toggleShown(shown, 'tasks')).toEqual({ goals: false, habits: false, tasks: true });
    });

    it('reads back what was stored and repairs what is not valid', () => {
        expect(normalizeRoadmapFilter({ shown: { goals: false }, time: 'evening', sort: 'name', direction: 1, sharedOnly: true }))
            .toEqual({ shown: { goals: false, habits: true, tasks: true }, time: 'evening', sort: 'name', direction: 1, sharedOnly: true });
        expect(normalizeRoadmapFilter({ shown: { goals: false, habits: false, tasks: false }, time: 'noon' })).toEqual(DEFAULT_ROADMAP_FILTER);
        expect(normalizeRoadmapFilter('junk')).toEqual(DEFAULT_ROADMAP_FILTER);
    });

    it('knows when it is narrowing the list', () => {
        expect(isFiltered(DEFAULT_ROADMAP_FILTER)).toBe(false);
        expect(isFiltered({ ...DEFAULT_ROADMAP_FILTER, shown: { goals: false, habits: true, tasks: true } })).toBe(true);
    });
});
