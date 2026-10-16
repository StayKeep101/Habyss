import { useEffect, useSyncExternalStore } from 'react';
import { currentProfile, getProfile, subscribeProfile, type Profile } from '@/lib/profile';

/**
 * Your profile — name, photo, cover, bio — from the one copy in lib/profile.ts.
 * Every screen that shows you reads it here, so a change appears everywhere at once.
 */
export function useMyProfile(): Profile {
    const profile = useSyncExternalStore(subscribeProfile, currentProfile, currentProfile);
    useEffect(() => { void getProfile(); }, []);
    return profile;
}
