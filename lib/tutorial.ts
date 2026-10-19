import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The tutorial (How Habyss works) shows once, straight after onboarding.
 * Onboarding marks it due; Home takes the mark and opens it. Anyone who set
 * up before it existed is not interrupted: it is in Settings for them.
 */
const KEY = 'habyss_tutorial_pending';

export const markTutorialDue = () => AsyncStorage.setItem(KEY, '1').catch(() => undefined);

/** True once, if the tutorial is due; clears the mark. */
export async function takeTutorialDue(): Promise<boolean> {
    try {
        if ((await AsyncStorage.getItem(KEY)) !== '1') return false;
        await AsyncStorage.removeItem(KEY);
        return true;
    } catch {
        return false;
    }
}
