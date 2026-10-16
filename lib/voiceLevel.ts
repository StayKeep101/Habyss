import { makeMutable } from 'react-native-reanimated';

/**
 * How loud the voice is right now, 0–1, while the create button is held.
 * Written by the speech listener, read on the UI thread by the level meter,
 * so the bars move without a React render per sample.
 */
export const voiceLevel = makeMutable(0);

/** The speech module reports -2 (silence) to 10 (loud). */
export const normaliseLevel = (value: number): number => Math.max(0, Math.min(1, value / 10));
