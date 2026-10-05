import { Platform } from 'react-native';
import SharedDefaults from './SharedDefaults';
import type { WidgetPayload } from './widgetSync';
import type { EchoHour } from './echoLockScreen';

/**
 * The app group the widget reads from (`group.com.habyss.data`).
 *
 * Everything the widget draws is written here in one go, so the list, the
 * count and the ring can never disagree: they come from the same payload.
 * `lib/widgetSync.ts` decides what that payload is.
 */
export const WidgetService = {
    async write(payload: WidgetPayload): Promise<void> {
        if (Platform.OS !== 'ios') return;
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
        } catch (error) {
            console.warn('WidgetService: could not update the widget', error);
            throw error;
        }
    },

    /**
     * The hourly lines the lock-screen widget reads.
     *
     * Written on its own rather than with the day's list, because it changes
     * for a different reason: the list changes when something is ticked, the
     * lines change when the hour turns.
     */
    async writeEcho(hours: EchoHour[]): Promise<void> {
        if (Platform.OS !== 'ios') return;
        try {
            await SharedDefaults.set('echoHours', JSON.stringify(hours));
            await SharedDefaults.reloadTimelines();
        } catch (error) {
            console.warn('WidgetService: could not update Echo', error);
        }
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
