import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The roadmap's filter, remembered between launches.
 *
 * What to show is three switches rather than one choice, so "tasks and habits,
 * no goals" is possible; at least one always stays on, so the list is never
 * empty by accident.
 */
export type ShownKind = 'goals' | 'habits' | 'tasks';
export type TimeOfDay = 'all' | 'morning' | 'afternoon' | 'evening';
export type RoadmapSort = 'default' | 'name' | 'progress' | 'priority';
/** The day as a timeline in time order, or the goals, habits and tasks as lists. */
export type RoadmapView = 'timeline' | 'list';

export interface RoadmapFilterState {
    shown: Record<ShownKind, boolean>;
    time: TimeOfDay;
    sharedOnly: boolean;
    sort: RoadmapSort;
    direction: 1 | -1;
    view: RoadmapView;
}

export const DEFAULT_ROADMAP_FILTER: RoadmapFilterState = {
    shown: { goals: true, habits: true, tasks: true },
    time: 'all',
    sharedOnly: false,
    sort: 'default',
    direction: -1,
    view: 'timeline',
};

const KEY = 'habyss_roadmap_filter';
const TIMES: TimeOfDay[] = ['all', 'morning', 'afternoon', 'evening'];
const SORTS: RoadmapSort[] = ['default', 'name', 'progress', 'priority'];

/** Whatever was stored, made safe: unknown values fall back to the default. */
export function normalizeRoadmapFilter(raw: unknown): RoadmapFilterState {
    const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<RoadmapFilterState>;
    const shown = { ...DEFAULT_ROADMAP_FILTER.shown };
    for (const kind of Object.keys(shown) as ShownKind[]) {
        if (typeof value.shown?.[kind] === 'boolean') shown[kind] = value.shown[kind];
    }
    if (!shown.goals && !shown.habits && !shown.tasks) Object.assign(shown, DEFAULT_ROADMAP_FILTER.shown);
    return {
        shown,
        time: TIMES.includes(value.time as TimeOfDay) ? value.time as TimeOfDay : 'all',
        sharedOnly: value.sharedOnly === true,
        sort: SORTS.includes(value.sort as RoadmapSort) ? value.sort as RoadmapSort : 'default',
        direction: value.direction === 1 ? 1 : -1,
        view: value.view === 'list' ? 'list' : 'timeline',
    };
}

/** Flips one kind on or off, unless it is the last one showing. */
export function toggleShown(shown: Record<ShownKind, boolean>, kind: ShownKind): Record<ShownKind, boolean> {
    const next = { ...shown, [kind]: !shown[kind] };
    return next.goals || next.habits || next.tasks ? next : shown;
}

export const isFiltered = (state: RoadmapFilterState): boolean =>
    !state.shown.goals || !state.shown.habits || !state.shown.tasks
    || state.time !== 'all' || state.sharedOnly || state.sort !== 'default';

/**
 * Read once (the tab bar asks for it at launch) and kept, so the Roadmap opens
 * already in the view you left it in, never the default for a frame first.
 */
let cached: RoadmapFilterState | null = null;
export const cachedRoadmapFilter = (): RoadmapFilterState | null => cached;

export async function loadRoadmapFilter(): Promise<RoadmapFilterState> {
    if (cached) return cached;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        cached = normalizeRoadmapFilter(raw ? JSON.parse(raw) : null);
    } catch {
        cached = DEFAULT_ROADMAP_FILTER;
    }
    return cached;
}

export async function saveRoadmapFilter(state: RoadmapFilterState): Promise<void> {
    cached = state;
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}

/** What the list sorts on, the same for a goal, a habit and a task. */
export interface Sortable {
    name: string;
    createdAt?: string;
    /** 1 urgent, 2 normal (unset), 3 not urgent. */
    priority?: 1 | 2 | 3;
    /** 1 easy, 2 medium, 3 hard. */
    difficulty?: 1 | 2 | 3;
    done?: boolean;
}

/**
 * The list's order. Priority, going up (the first tap), puts the most
 * important first: urgent before normal before not urgent, the harder one
 * first between two as urgent, then by name. Tapping it again turns it round.
 */
export function compareBySort(sort: RoadmapSort, direction: 1 | -1) {
    return (a: Sortable, b: Sortable): number => {
        if (sort === 'name') return direction * a.name.localeCompare(b.name);
        if (sort === 'progress') return direction * (Number(!!a.done) - Number(!!b.done));
        if (sort === 'priority') {
            const urgency = (a.priority ?? 2) - (b.priority ?? 2);
            const effort = (b.difficulty ?? 2) - (a.difficulty ?? 2);
            return direction * (urgency || effort || a.name.localeCompare(b.name));
        }
        return direction * (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    };
}
