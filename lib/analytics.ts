import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Product events: what step a person reached, never what they wrote. Kept on
 * the phone (the last 200), for the app's own use and for a crash report's
 * context, until a real analytics service is chosen; then `track` is the one
 * place it is wired in. Free text (a name, a goal in their words) is never
 * passed here.
 */
export type ProductEvent =
    | 'onboarding_started' | 'eco_introduction_completed' | 'obstacle_selected' | 'source_selected'
    | 'goal_selected' | 'first_action_created' | 'friend_invite_selected' | 'echo_built' | 'onboarding_completed'
    | 'onboarding_skipped' | 'first_action_completed';

type Props = Record<string, string | number | boolean | null | undefined>;
const KEY = 'habyss_events';
const LIMIT = 200;

export function track(event: ProductEvent, props: Props = {}): void {
    const entry = { event, props, at: new Date().toISOString() };
    if (__DEV__) console.log('[event]', event, props);
    void AsyncStorage.getItem(KEY)
        .then(raw => {
            const list = (() => { try { return JSON.parse(raw ?? '[]') as unknown[]; } catch { return []; } })();
            return AsyncStorage.setItem(KEY, JSON.stringify([...list, entry].slice(-LIMIT)));
        })
        .catch(() => undefined);
}

export async function recentEvents(): Promise<{ event: ProductEvent; props: Props; at: string }[]> {
    try { return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'); } catch { return []; }
}
