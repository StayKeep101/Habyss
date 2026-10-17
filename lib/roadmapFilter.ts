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
export type RoadmapSort = 'default' | 'name' | 'progress';

export interface RoadmapFilterState {
    shown: Record<ShownKind, boolean>;
    time: TimeOfDay;
    sharedOnly: boolean;
    sort: RoadmapSort;
    direction: 1 | -1;
}

export const DEFAULT_ROADMAP_FILTER: RoadmapFilterState = {
    shown: { goals: true, habits: true, tasks: true },
    time: 'all',
    sharedOnly: false,
    sort: 'default',
    direction: -1,
};

const KEY = 'habyss_roadmap_filter';
const TIMES: TimeOfDay[] = ['all', 'morning', 'afternoon', 'evening'];
const SORTS: RoadmapSort[] = ['default', 'name', 'progress'];

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

export async function loadRoadmapFilter(): Promise<RoadmapFilterState> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        return normalizeRoadmapFilter(raw ? JSON.parse(raw) : null);
    } catch {
        return DEFAULT_ROADMAP_FILTER;
    }
}

export async function saveRoadmapFilter(state: RoadmapFilterState): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}
