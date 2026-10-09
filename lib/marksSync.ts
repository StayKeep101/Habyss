import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';

/**
 * Puts your Marks total where your friends can see it.
 *
 * Only the number — nothing about what earned it — and nothing at all when
 * you have switched off sharing your progress. Sent only when it changes, so
 * ticking things off costs no network call unless the total actually moved.
 */
const KEY = 'marks_published';

export async function publishMarks(total: number): Promise<void> {
    try {
        const sb = getSupabase();
        if (!sb) return;
        const { data } = await sb.auth.getSession();
        const me = data.session?.user?.id;
        if (!me) return;
        const { getSharing } = require('./profileSync') as typeof import('./profileSync');
        const allowed = (await getSharing()).progress;
        const value = allowed ? Math.max(0, Math.round(total)) : null;
        const stamp = `${me}:${value}`;
        if ((await AsyncStorage.getItem(KEY)) === stamp) return;
        const { error } = await sb.from('profiles')
            .update({ marks: value, marks_updated_at: new Date().toISOString() }).eq('id', me);
        // A server without the column yet is not an error worth retrying hard.
        if (!error) await AsyncStorage.setItem(KEY, stamp);
    } catch {
        // Friends see a slightly older total; nothing on this phone is affected.
    }
}
