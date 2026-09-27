import { Platform } from 'react-native';

/**
 * Which integrations can actually do something in this build.
 *
 * Settings and the integrations screen both read from here so the entry point
 * cannot advertise something the screen then refuses to do.
 */

/** Health is written through react-native-health, which is iOS only. */
export const isHealthAvailable = (): boolean => Platform.OS === 'ios';

export const hasAnyIntegration = (): boolean => isHealthAvailable();

/** Short, true summary for the settings row. */
export const integrationsSummary = (): string => (isHealthAvailable() ? 'Apple Health' : '');
