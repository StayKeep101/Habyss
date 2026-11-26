import { DEFAULT_ROADMAP_FILTER, isFiltered, normalizeRoadmapFilter, toggleShown } from '../roadmapFilter';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

describe('the roadmap filter', () => {
    it('can show tasks without habits', () => {
        const shown = toggleShown(DEFAULT_ROADMAP_FILTER.shown, 'habits');
        expect(shown).toEqual({ habits: false, tasks: true });
    });

    it('never hides everything', () => {
        const shown = toggleShown(DEFAULT_ROADMAP_FILTER.shown, 'habits');
        expect(toggleShown(shown, 'tasks')).toEqual({ habits: false, tasks: true });
    });

    it('reads back what was stored and repairs what is not valid', () => {
        expect(normalizeRoadmapFilter({ shown: { habits: false }, time: 'evening', sort: 'name', direction: 1, sharedOnly: true }))
            .toEqual({ shown: { habits: false, tasks: true }, time: 'evening', sort: 'name', direction: 1, sharedOnly: true, view: 'timeline' });
        // The view is remembered too: the lists, or the day as a timeline (the default).
        expect(normalizeRoadmapFilter({ view: 'list' }).view).toBe('list');
        expect(normalizeRoadmapFilter({ view: 'grid' }).view).toBe('timeline');
        expect(normalizeRoadmapFilter({ shown: { habits: false, tasks: false }, time: 'noon' })).toEqual(DEFAULT_ROADMAP_FILTER);
        expect(normalizeRoadmapFilter('junk')).toEqual(DEFAULT_ROADMAP_FILTER);
    });

    it('knows when it is narrowing the list', () => {
        expect(isFiltered(DEFAULT_ROADMAP_FILTER)).toBe(false);
        expect(isFiltered({ ...DEFAULT_ROADMAP_FILTER, shown: { habits: false, tasks: true } })).toBe(true);
    });
});

describe('sorting by priority', () => {
    const { compareBySort } = require('../roadmapFilter') as typeof import('../roadmapFilter');
    const items = [
        { name: 'Later', priority: 3 as const },
        { name: 'Plain' },
        { name: 'Easy urgent', priority: 1 as const, difficulty: 1 as const },
        { name: 'Hard urgent', priority: 1 as const, difficulty: 3 as const },
    ];
    it('puts the most important first, the harder of two urgent ones first', () => {
        expect([...items].sort(compareBySort('priority', 1)).map(i => i.name)).toEqual(['Hard urgent', 'Easy urgent', 'Plain', 'Later']);
    });
    it('turned round, the least important first', () => {
        expect([...items].sort(compareBySort('priority', -1)).map(i => i.name)[0]).toBe('Later');
    });
    it('is remembered', () => {
        const { normalizeRoadmapFilter } = require('../roadmapFilter') as typeof import('../roadmapFilter');
        expect(normalizeRoadmapFilter({ sort: 'priority' }).sort).toBe('priority');
    });
});
