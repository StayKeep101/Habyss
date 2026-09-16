import { Platform } from 'react-native';

/**
 * Which integrations can actually do something in this build.
 *
 * Settings and the integrations screen both read from here so the entry point
 * cannot advertise something the screen then refuses to do.
 */

/** Health is written through react-native-health, which is iOS only. */
export const isHealthAvailable = (): boolean => Platform.OS === 'ios';

/**
 * Spotify needs a client id at build time. Without one the connect flow can only
 * show a configuration error, which is a message for the developer, not a user.
 */
export const isSpotifyConfigured = (): boolean => !!process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;

export const hasAnyIntegration = (): boolean => isHealthAvailable() || isSpotifyConfigured();

/** Short, true summary for the settings row. */
export const integrationsSummary = (): string => {
    const names: string[] = [];
    if (isHealthAvailable()) names.push('Apple Health');
    if (isSpotifyConfigured()) names.push('Spotify');
    return names.join(' · ');
};
