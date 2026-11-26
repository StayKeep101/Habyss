import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVoiceDestination, setVoiceDestination } from '../voiceDestination';

describe('where holding + sends your words', () => {
    beforeEach(() => AsyncStorage.clear());

    it('is understood for you (Auto) until you choose one place', async () => {
        expect(await getVoiceDestination()).toBe('auto');
        await setVoiceDestination('task');
        expect(await getVoiceDestination()).toBe('task');
    });
});
