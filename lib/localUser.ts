/**
 * Local User Identity - SQLite-Only Mode
 * 
 * Generates and persists a local user ID without requiring authentication.
 * Used as the primary user identifier for all SQLite operations.
 * When premium cloud sync is enabled later, this ID will be linked
 * to a Supabase auth account.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_USER_KEY = 'habyss_local_user_id';
const ONBOARDING_KEY = 'habyss_onboarding_complete';
export const PROFILE_NICKNAME_KEY = 'profile_nickname';

let cachedUserId: string | null = null;

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Get the local user ID. Creates one if it doesn't exist.
 * Always succeeds — no auth required.
 */
export async function getLocalUserId(): Promise<string> {
    if (cachedUserId) return cachedUserId;

    let userId = await AsyncStorage.getItem(LOCAL_USER_KEY);
    if (!userId) {
        userId = generateUUID();
        await AsyncStorage.setItem(LOCAL_USER_KEY, userId);
        console.log('[LocalUser] Created new local user ID:', userId);
    }
    cachedUserId = userId;
    return userId;
}

/**
 * Check if onboarding has been completed
 */
export async function isOnboardingComplete(): Promise<boolean> {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val === 'true';
}

/**
 * Mark onboarding as complete
 */
export async function setOnboardingComplete(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
}

export async function getLocalProfileName(): Promise<string | null> {
    return await AsyncStorage.getItem(PROFILE_NICKNAME_KEY);
}

export async function setLocalProfileName(name: string): Promise<void> {
    await AsyncStorage.setItem(PROFILE_NICKNAME_KEY, name.trim());
}

/**
 * Get cached user ID synchronously (returns null if not yet loaded)
 * Useful for non-async contexts where ID was already loaded
 */
export function getCachedUserId(): string | null {
    return cachedUserId;
}
