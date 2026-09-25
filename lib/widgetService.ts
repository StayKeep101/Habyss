import { Platform } from 'react-native';
import SharedDefaults from './SharedDefaults';
import type { WidgetPayload } from './widgetSync';

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
            await SharedDefaults.set('habitsData', JSON.stringify(payload.items));
            await SharedDefaults.set('widgetSummary', JSON.stringify({
                total: payload.total,
                completed: payload.completed,
            }));
            await SharedDefaults.set('streakCount', String(payload.streak));
            await SharedDefaults.set('topHabitName', payload.nextUp ?? '');
            await SharedDefaults.set('dayKey', payload.dayKey);
            await SharedDefaults.reloadTimelines();
        } catch (error) {
            console.warn('WidgetService: could not update the widget', error);
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
