/**
 * The day's settings as synced rows (public.day_inputs), one key per setting,
 * so phone and desktop build the same day and two devices changing different
 * settings never overwrite each other. Pure: lib/dayInputsSync.ts does the I/O.
 *
 * Keys (the desktop uses the same strings):
 *   day_window, meals, meals_flexible, auto_reschedule, peak,
 *   travel:<travel key>, and dated day_memory:/ended:/reschedule:/events:<YYYY-MM-DD>.
 */

export type DayInputKey = string;
export type DayInputRows = Record<DayInputKey, unknown>;
type Stores = Partial<Record<string, string>>;

/** AsyncStorage keys this module reads and writes. */
export const DAY_STORES = [
    'habyss_day_window', 'habyss_meals', 'habyss_meals_flexible', 'habyss_event_travel', 'habyss_day_memory',
    'habyss_ended_early', 'habyss_reschedules', 'habyss_flow_peak', 'app_settings',
] as const;

const parse = (raw: string | undefined): unknown => {
    if (raw == null) return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
};
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One stored day ({ day, at }) as its dated row. */
function dated(rows: DayInputRows, prefix: string, raw: string | undefined) {
    const v = parse(raw);
    if (isObject(v) && typeof v.day === 'string' && DAY.test(v.day) && isObject(v.at)) rows[`${prefix}:${v.day}`] = v.at;
}

/** The stores (raw AsyncStorage strings) as rows. `events`: calendar slots waiting to be published, by day. */
export function rowsFromStores(stores: Stores, events: Record<string, unknown[]> = {}): DayInputRows {
    const rows: DayInputRows = {};
    const window = parse(stores.habyss_day_window);
    if (isObject(window)) rows.day_window = window;
    const meals = parse(stores.habyss_meals);
    if (isObject(meals)) rows.meals = meals;
    if (stores.habyss_meals_flexible != null) rows.meals_flexible = stores.habyss_meals_flexible === 'true';
    const travel = parse(stores.habyss_event_travel);
    if (isObject(travel)) for (const [key, value] of Object.entries(travel)) rows[`travel:${key}`] = value;
    const memory = parse(stores.habyss_day_memory);
    if (isObject(memory) && typeof memory.day === 'string' && DAY.test(memory.day)) rows[`day_memory:${memory.day}`] = memory;
    dated(rows, 'ended', stores.habyss_ended_early);
    dated(rows, 'reschedule', stores.habyss_reschedules);
    if (stores.habyss_flow_peak != null) { const peak = parse(stores.habyss_flow_peak); if (peak === null || isObject(peak)) rows.peak = peak; }
    const settings = parse(stores.app_settings);
    if (isObject(settings) && typeof settings.autoReschedule === 'boolean') rows.auto_reschedule = settings.autoReschedule;
    for (const [day, slots] of Object.entries(events)) if (DAY.test(day)) rows[`events:${day}`] = slots;
    return rows;
}

/**
 * Rows back into stores. The one-day stores take only `today`'s row. `existing` supplies
 * the stores that hold more than a day setting (app_settings), so only that field changes.
 */
export function storesFromRows(rows: DayInputRows, today: string, existing: Stores = {}): Stores {
    const out: Stores = {};
    if (isObject(rows.day_window)) out.habyss_day_window = JSON.stringify(rows.day_window);
    if (isObject(rows.meals)) out.habyss_meals = JSON.stringify(rows.meals);
    if (typeof rows.meals_flexible === 'boolean') out.habyss_meals_flexible = String(rows.meals_flexible);
    const travel: Record<string, unknown> = {};
    let anyTravel = false;
    for (const [key, value] of Object.entries(rows)) if (key.startsWith('travel:')) { travel[key.slice(7)] = value; anyTravel = true; }
    if (anyTravel) out.habyss_event_travel = JSON.stringify(travel);
    const memory = rows[`day_memory:${today}`];
    if (isObject(memory)) out.habyss_day_memory = JSON.stringify(memory);
    const ended = rows[`ended:${today}`];
    if (isObject(ended)) out.habyss_ended_early = JSON.stringify({ day: today, at: ended });
    const moved = rows[`reschedule:${today}`];
    if (isObject(moved)) out.habyss_reschedules = JSON.stringify({ day: today, at: moved });
    if ('peak' in rows && (rows.peak === null || isObject(rows.peak))) out.habyss_flow_peak = JSON.stringify(rows.peak);
    if (typeof rows.auto_reschedule === 'boolean') {
        const settings = parse(existing.app_settings);
        out.app_settings = JSON.stringify({ ...(isObject(settings) ? settings : {}), autoReschedule: rows.auto_reschedule });
    }
    return out;
}

/** Dated keys more than `keepDays` before `today`: deleted from the cloud so the table stays small. */
export function staleKeys(keys: DayInputKey[], today: string, keepDays = 14): DayInputKey[] {
    const [y, m, d] = today.split('-').map(Number);
    const cut = new Date(y, m - 1, d - keepDays);
    const cutKey = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}-${String(cut.getDate()).padStart(2, '0')}`;
    return keys.filter(key => { const day = key.split(':')[1]; return !!day && DAY.test(day) && day < cutKey; });
}
