import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where holding the create button and speaking sends what was said.
 * Brain dump by default: the quickest place to get a thought out of your head.
 */
export type VoiceDestination = 'thought' | 'task' | 'habit' | 'goal';

const KEY = 'habyss_voice_destination';
export const DEFAULT_VOICE_DESTINATION: VoiceDestination = 'thought';

export const VOICE_DESTINATIONS: { id: VoiceDestination; label: string }[] = [
    { id: 'thought', label: 'Dump' },
    { id: 'task', label: 'Task' },
    { id: 'habit', label: 'Habit' },
    { id: 'goal', label: 'Goal' },
];

export async function getVoiceDestination(): Promise<VoiceDestination> {
    try {
        const stored = await AsyncStorage.getItem(KEY);
        return VOICE_DESTINATIONS.some(option => option.id === stored) ? (stored as VoiceDestination) : DEFAULT_VOICE_DESTINATION;
    } catch {
        return DEFAULT_VOICE_DESTINATION;
    }
}

export async function setVoiceDestination(destination: VoiceDestination): Promise<void> {
    await AsyncStorage.setItem(KEY, destination).catch(() => undefined);
}
