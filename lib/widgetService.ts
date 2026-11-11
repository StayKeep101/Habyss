import { Platform } from 'react-native';
import SharedDefaults from './SharedDefaults';
import type { WidgetPayload } from './widgetSync';
import type { WidgetDay, WidgetShards } from './widgetDay';

/**
 * The app group the widget reads from (`group.com.habyss.data`).
 *
 * Everything the widget draws is written here in one go, so the list, the
 * count and the ring can never disagree: they come from the same payload.
 * `lib/widgetSync.ts` decides what that payload is.
 */
/**
 * What was last handed to the widget. Redrawing a widget is real work for iOS,
 * and the app refreshes on every change and once a minute, so an unchanged
 * snapshot is not written or redrawn again.
 */
let lastPayload: string | null = null;
let lastDay: string | null = null;
let lastShards: string | null = null;
let lastShardsNumbers: string | null = null;

/** Writes one shared value and redraws the widgets, unless it is what they already show. */
async function writeOnce(key: string, value: string, last: string | null): Promise<string | null> {
    if (Platform.OS !== 'ios' || value === last) return last;
    try {
        if (!(await SharedDefaults.set(key, value))) return last;
        await SharedDefaults.reloadTimelines();
        return value;
    } catch (error) {
        console.warn(`WidgetService: could not update ${key}`, error);
        return last;
    }
}

export const WidgetService = {
    async write(payload: WidgetPayload): Promise<void> {
        if (Platform.OS !== 'ios') return;
        const fingerprint = JSON.stringify(payload);
        if (fingerprint === lastPayload) return;
        try {
            if (payload.dashboard && !(await SharedDefaults.set('widgetDashboard', JSON.stringify(payload.dashboard)))) {
                throw new Error('The iOS widget storage bridge is unavailable. Rebuild Habyss with SharedDefaults and its App Group entitlement.');
            }
            await SharedDefaults.set('habitsData', JSON.stringify(payload.items));
            // Siri asks about habits; the legacy widget list also contains tasks.
            await SharedDefaults.set('siriHabitsData', JSON.stringify(payload.items.filter(item => item.id.startsWith('habit:'))));
            await SharedDefaults.set('widgetSummary', JSON.stringify({
                total: payload.total,
                completed: payload.completed,
            }));
            await SharedDefaults.set('streakCount', String(payload.streak));
            await SharedDefaults.set('topHabitName', payload.nextUp ?? '');
            await SharedDefaults.set('dayKey', payload.dayKey);
            // The widget cannot reach the app's palette, so it is handed the
            // two colours rather than the name of a gradient.
            if (payload.accent) {
                await SharedDefaults.set('accentFrom', payload.accent.from);
                await SharedDefaults.set('accentTo', payload.accent.to);
            }
            await SharedDefaults.reloadTimelines();
            lastPayload = fingerprint;
        } catch (error) {
            console.warn('WidgetService: could not update the widget', error);
            throw error;
        }
    },

    /** Today's timeline for the Day widget (lib/widgetDay.ts). */
    async writeDay(day: WidgetDay): Promise<void> {
        lastDay = await writeOnce('widgetDay', JSON.stringify(day), lastDay);
    },

    /** The Shards balance for the Shards widget (lib/widgetDay.ts). */
    async writeShards(shards: WidgetShards): Promise<void> {
        // Its clock moves every write: only the numbers decide whether to redraw.
        const { at: _at, ...numbers } = shards;
        const fingerprint = JSON.stringify(numbers);
        if (fingerprint === lastShardsNumbers) return;
        const written = await writeOnce('widgetShards', JSON.stringify(shards), lastShards);
        if (written !== lastShards) { lastShards = written; lastShardsNumbers = fingerprint; }
    },

    /** Redraws the widget without changing what it shows. */
    async reloadTimelines(): Promise<void> {
        if (Platform.OS !== 'ios') return;
        try {
            await SharedDefaults.reloadTimelines();
        } catch (error) {
            console.warn('WidgetService: could not reload the widget', error);
        }
    },
};
