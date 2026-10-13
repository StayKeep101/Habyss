import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';

/**
 * Legacy store.
 *
 * The app reads the coach from `app_settings.aiPersonality` via AppSettings;
 * this context kept a second copy under `ai_personality_mode` that nothing
 * consumed, so writing here had no effect on coaching. It now mirrors into the
 * same key AppSettings uses, so any remaining caller stays consistent.
 */
const APP_SETTINGS_KEY = 'app_settings';

type AIPersonalityContextType = {
    personalityId: PersonalityModeId;
    setPersonalityId: (id: PersonalityModeId) => Promise<void>;
    isLoading: boolean;
};

const AIPersonalityContext = createContext<AIPersonalityContextType>({
    personalityId: 'normal',
    setPersonalityId: async () => { },
    isLoading: true,
});

export const AIPersonalityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [personalityId, setPersonalityIdState] = useState<PersonalityModeId>('normal');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadPersonality();
    }, []);

    const loadPersonality = async () => {
        try {
            const stored = await AsyncStorage.getItem('ai_personality_mode');
            if (stored && PERSONALITY_MODES.find(m => m.id === stored)) {
                setPersonalityIdState(stored as PersonalityModeId);
            }
        } catch (e) {
            console.error('Failed to load personality', e);
        } finally {
            setIsLoading(false);
        }
    };

    const setPersonalityId = async (id: PersonalityModeId) => {
        try {
            await AsyncStorage.setItem('ai_personality_mode', id);
            // Mirror into the settings blob the rest of the app reads.
            const raw = await AsyncStorage.getItem(APP_SETTINGS_KEY);
            const settings = raw ? JSON.parse(raw) : {};
            await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify({ ...settings, aiPersonality: id }));
            setPersonalityIdState(id);
        } catch (e) {
            console.error('Failed to save personality', e);
        }
    };

    return (
        <AIPersonalityContext.Provider value={{ personalityId, setPersonalityId, isLoading }}>
            {children}
        </AIPersonalityContext.Provider>
    );
};

export const useAIPersonality = () => useContext(AIPersonalityContext);
