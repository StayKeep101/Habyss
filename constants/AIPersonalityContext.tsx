import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERSONALITY_MODES, PersonalityModeId } from './AIPersonalities';

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
