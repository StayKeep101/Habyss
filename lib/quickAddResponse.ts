import type * as Notifications from 'expo-notifications';
import { emit } from './appEvents';
import { QUICK_ADD_ACTION, QUICK_ADD_CATEGORIES } from './notificationActions';
import { addQuick, quickAddSummary } from './shortcutsInbox';

type QuickCategory = keyof typeof QUICK_ADD_CATEGORIES;

/** Which add notification this is (the widget's tiles post them), or null. */
export function quickAddKindOf(response: Notifications.NotificationResponse) {
    const category = response.notification.request.content.categoryIdentifier as string | null | undefined;
    return category && category in QUICK_ADD_CATEGORIES ? QUICK_ADD_CATEGORIES[category as QuickCategory].kind : null;
}

/**
 * The answer to an add notification. Typed into it: added at once, without
 * opening Habyss, and a quiet notification says what was added. Tapped
 * instead: the composer for that kind opens, keyboard up. False when the
 * notification is not one of these.
 */
export async function handleQuickAddResponse(response: Notifications.NotificationResponse): Promise<boolean> {
    const kind = quickAddKindOf(response);
    if (!kind) return false;
    const Notes = require('expo-notifications') as typeof import('expo-notifications');
    if (response.actionIdentifier !== QUICK_ADD_ACTION) {
        if (response.actionIdentifier === Notes.DEFAULT_ACTION_IDENTIFIER) {
            const target = kind === 'any' ? 'task' : kind === 'thought' ? 'braindump' : kind;
            setTimeout(() => { require('expo-router').router.navigate({ pathname: '/add', params: { kind: target } }); }, 500);
        }
        return true;
    }
    const text = (response as { userText?: string }).userText?.trim();
    if (!text) return true;
    const result = await addQuick(kind, text);
    if (result.tasks.length) emit('tasks_changed');
    if (result.habits.length || result.goals.length) emit('habit_updated', {});
    const said = quickAddSummary(result);
    await Notes.scheduleNotificationAsync({
        content: { title: said ? '✓ Added' : 'Could not add that', body: said ?? 'Open Habyss and try again.', sound: false, data: { kind: 'quick-added' } },
        trigger: null,
    }).catch(() => undefined);
    return true;
}
