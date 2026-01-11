import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalityModeId } from '@/constants/AIPersonalities';


export type RoadMapCardSize = 'small' | 'standard' | 'big';
export type GreetingStyle = 'ai' | 'quotes' | 'data' | 'all';  // ai=personality, quotes=motivational, data=insights, all=random mix

interface AppSettings {
    hapticsEnabled: boolean;
    soundsEnabled: boolean;
    notificationsEnabled: boolean;
    aiPersonality: PersonalityModeId;
    cardSize: RoadMapCardSize;
    greetingStyle: GreetingStyle;
}

interface AppSettingsContextType extends AppSettings {
    setHapticsEnabled: (enabled: boolean) => void;
    setSoundsEnabled: (enabled: boolean) => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    setAIPersonality: (personality: PersonalityModeId) => void;
    setCardSize: (size: RoadMapCardSize) => void;
    setGreetingStyle: (style: GreetingStyle) => void;
    isLoaded: boolean;
}

const defaultSettings: AppSettings = {
    hapticsEnabled: true,
    soundsEnabled: true,
    notificationsEnabled: true,
    aiPersonality: 'friendly',
    cardSize: 'small',
    greetingStyle: 'ai', // Default to AI-powered greetings
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'app_settings';

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setSettings({ ...defaultSettings, ...parsed });
                }
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
            setIsLoaded(true);
        };
        loadSettings();
    }, []);

    // Save settings whenever they change
    const saveSettings = async (newSettings: AppSettings) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    };

    const setHapticsEnabled = (enabled: boolean) => {
        const newSettings = { ...settings, hapticsEnabled: enabled };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const setSoundsEnabled = (enabled: boolean) => {
        const newSettings = { ...settings, soundsEnabled: enabled };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const setNotificationsEnabled = (enabled: boolean) => {
        const newSettings = { ...settings, notificationsEnabled: enabled };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const setAIPersonality = (personality: PersonalityModeId) => {
        const newSettings = { ...settings, aiPersonality: personality };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const setCardSize = (size: RoadMapCardSize) => {
        const newSettings = { ...settings, cardSize: size };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const setGreetingStyle = (style: GreetingStyle) => {
        const newSettings = { ...settings, greetingStyle: style };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    return (
        <AppSettingsContext.Provider
            value={{
                ...settings,
                setHapticsEnabled,
                setSoundsEnabled,
                setNotificationsEnabled,
                setAIPersonality,
                setCardSize,
                setGreetingStyle,
                isLoaded,
            }}
        >
            {children}
        </AppSettingsContext.Provider>
    );
};

export const useAppSettings = (): AppSettingsContextType => {
    const context = useContext(AppSettingsContext);
    if (!context) {
        throw new Error('useAppSettings must be used within an AppSettingsProvider');
    }
    return context;
};

// Helper hook that respects global haptics setting
export const useGlobalHaptics = () => {
    const { hapticsEnabled } = useAppSettings();

    return {
        enabled: hapticsEnabled,
        // Only trigger if enabled
        trigger: (callback: () => void) => {
            if (hapticsEnabled) {
                callback();
            }
        },
    };
};
