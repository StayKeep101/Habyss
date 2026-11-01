import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where holding the create button and speaking sends what was said. Auto by
 * default: speak freely, and Habyss works out the tasks, habits and goals in
 * it (lib/voicePlan.ts), with as little as possible between the thought, the
 * plan and doing it. Or always one place: the brain dump, a task, a habit, a goal.
 */
export type VoiceDestination = 'auto' | 'thought' | 'task' | 'habit' | 'goal';

const KEY = 'habyss_voice_destination';
export const DEFAULT_VOICE_DESTINATION: VoiceDestination = 'auto';

export const VOICE_DESTINATIONS: { id: VoiceDestination; label: string }[] = [
    { id: 'auto', label: 'Auto' },
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
