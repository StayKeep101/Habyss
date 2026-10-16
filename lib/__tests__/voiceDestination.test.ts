import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVoiceDestination, setVoiceDestination } from '../voiceDestination';

describe('where holding + sends your words', () => {
    beforeEach(() => AsyncStorage.clear());

    it('goes to the brain dump until you choose otherwise', async () => {
        expect(await getVoiceDestination()).toBe('thought');
        await setVoiceDestination('task');
        expect(await getVoiceDestination()).toBe('task');
    });
});
