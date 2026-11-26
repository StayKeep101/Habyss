import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The one Supabase client.
 *
 * Only ever holds the publishable key, which is safe to ship: what it can read
 * and write is decided by the row-level security rules on the server, not by
 * the key. Nothing with admin rights belongs in the app.
 *
 * The app works without an account. This client is only exercised once someone
 * signs in to back up, move to a new phone, or add friends.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** False in a build without Supabase configured; callers show that plainly. */
export const isCloudConfigured = (): boolean => !!url && !!key;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
    if (!isCloudConfigured()) return null;
    if (!client) {
        client = createClient(url!, key!, {
            auth: {
                storage: AsyncStorage,
                persistSession: true,
                autoRefreshToken: true,
                // Google sign-in hands back a one-time code that
                // lib/socialSignIn.ts exchanges itself; PKCE keeps that code
                // useless to anyone who intercepts it.
                flowType: 'pkce',
                detectSessionInUrl: false,
            },
        });

        // Refresh the session only while the app is in use, as Supabase
        // recommends for React Native, so a backgrounded app is not woken by it.
        AppState.addEventListener('change', state => {
            if (state === 'active') client?.auth.startAutoRefresh();
            else client?.auth.stopAutoRefresh();
        });
    }
    return client;
}
