import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalityModeId } from '@/constants/AIPersonalities';
import { verifyAppLockChange } from '@/lib/biometricLock';

export type RoadMapCardSize = 'small' | 'standard' | 'big';
export type GreetingStyle = 'ai' | 'quotes' | 'data' | 'all';
export type MotivationStyle = 'gentle' | 'tough_love';
export type CommunicationStyle = 'empathetic' | 'direct' | 'philosophical';

interface AppSettings {
    hapticsEnabled: boolean;
    soundsEnabled: boolean;
    notificationsEnabled: boolean;
    aiPersonality: PersonalityModeId;
    cardSize: RoadMapCardSize;
    greetingStyle: GreetingStyle;
    useLocalAI: boolean;
    isAppLockEnabled: boolean;
    motivationStyle: MotivationStyle;
    communicationStyle: CommunicationStyle;
}

interface AppSettingsContextType extends AppSettings {
    setHapticsEnabled: (enabled: boolean) => void;
    setSoundsEnabled: (enabled: boolean) => void;
    setNotificationsEnabled: (enabled: boolean) => Promise<void>;
    setAIPersonality: (personality: PersonalityModeId) => void;
    setCardSize: (size: RoadMapCardSize) => void;
    setGreetingStyle: (style: GreetingStyle) => void;
    setUseLocalAI: (enabled: boolean) => void;
    setIsAppLockEnabled: (enabled: boolean) => Promise<boolean>;
    appLockVerifiedAt: number;
    setMotivationStyle: (style: MotivationStyle) => void;
    setCommunicationStyle: (style: CommunicationStyle) => void;
    isLoaded: boolean;
}

const defaultSettings: AppSettings = {
    hapticsEnabled: true,
    soundsEnabled: true,
    notificationsEnabled: true,
    aiPersonality: 'friendly',
    cardSize: 'small',
    greetingStyle: 'ai',
    useLocalAI: true,
    isAppLockEnabled: false,
    motivationStyle: 'gentle',
    communicationStyle: 'empathetic',
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'app_settings';

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);
    const [appLockVerifiedAt, setAppLockVerifiedAt] = useState(0);
    const lockChangePending = useRef(false);

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
                // Unknown settings are not proof that App Lock is off.
                setSettings(previous => ({ ...previous, isAppLockEnabled: true }));
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

    const setNotificationsEnabled = async (enabled: boolean) => {
        const newSettings = { ...settings, notificationsEnabled: enabled };
        setSettings(newSettings);
        await saveSettings(newSettings)
            .then(() => require('@/lib/notificationService').NotificationService.refreshReminders())
            .catch(() => undefined);
    };

    const setAIPersonality = (personality: PersonalityModeId) => {
        const newSettings = { ...settings, aiPersonality: personality };
        setSettings(newSettings);
        // Reminders already scheduled were written in the old voice; rewrite
        // them once the new one is stored, since that is where they read it.
        saveSettings(newSettings)
            .then(() => require('@/lib/notificationService').NotificationService.refreshHabitReminders())
            .catch(() => undefined);
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

    const setUseLocalAI = (enabled: boolean) => {
        const newSettings = { ...settings, useLocalAI: enabled };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const setIsAppLockEnabled = async (enabled: boolean): Promise<boolean> => {
        if (!isLoaded || lockChangePending.current) return false;
        lockChangePending.current = true;
        try {
            if (!(await verifyAppLockChange(enabled))) return false;
            const newSettings = { ...settings, isAppLockEnabled: enabled };
            // Show the switch as on only after its preference is durable.
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
            setAppLockVerifiedAt(Date.now());
            setSettings(newSettings);
            return true;
        } finally {
            lockChangePending.current = false;
        }
    };

    const setMotivationStyle = (style: 'gentle' | 'tough_love') => {
        const newSettings = { ...settings, motivationStyle: style };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const setCommunicationStyle = (style: 'empathetic' | 'direct' | 'philosophical') => {
        const newSettings = { ...settings, communicationStyle: style };
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
                setUseLocalAI,
                setIsAppLockEnabled,
                appLockVerifiedAt,
                setMotivationStyle,
                setCommunicationStyle, // Export new setters
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
