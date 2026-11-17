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
    /** No longer used: music plays only in Focus now (lib/focusMusic.ts). Kept so saved settings still read. */
    musicEnabled: boolean;
    /** The timeline moves habits and tasks for you (lib/dayFlow.ts); off, everything stays at its time. */
    autoReschedule: boolean;
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
    setAutoReschedule: (enabled: boolean) => void;
    setSoundsEnabled: (enabled: boolean) => void;
    setMusicEnabled: (enabled: boolean) => void;
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
    musicEnabled: true,
    autoReschedule: true,
    notificationsEnabled: true,
    aiPersonality: 'friendly',
    cardSize: 'standard',
    greetingStyle: 'ai',
    useLocalAI: true,
    isAppLockEnabled: false,
    motivationStyle: 'gentle',
    communicationStyle: 'empathetic',
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'app_settings';

/** Whether the timeline moves things, read outside any screen (the Live Activity, widgets). */
export async function readAutoReschedule(): Promise<boolean> {
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored).autoReschedule !== false : true;
    } catch { return true; }
}

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);
    const [appLockVerifiedAt, setAppLockVerifiedAt] = useState(0);
    const lockChangePending = useRef(false);
    // The newest settings, and any change made before the stored copy was read.
    // Each change is laid on top of what is stored, so changing one setting
    // early (or two quickly) can never put the others back to their defaults.
    const latest = useRef<AppSettings>(defaultSettings);
    const loadedRef = useRef(false);
    const early = useRef<Partial<AppSettings>>({});

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                const parsed = stored ? JSON.parse(stored) : {};
                latest.current = { ...defaultSettings, ...parsed, ...early.current };
                setSettings(latest.current);
                if (Object.keys(early.current).length) void saveSettings(latest.current);
            } catch (e) {
                console.error('Failed to load settings:', e);
                // Unknown settings are not proof that App Lock is off.
                latest.current = { ...latest.current, isAppLockEnabled: true };
                setSettings(latest.current);
            }
            loadedRef.current = true;
            setIsLoaded(true);
        };
        loadSettings();
    }, []);

    /** One change, on top of the newest settings; stored once the saved copy has been read. */
    const change = (patch: Partial<AppSettings>): AppSettings => {
        latest.current = { ...latest.current, ...patch };
        setSettings(latest.current);
        if (!loadedRef.current) early.current = { ...early.current, ...patch };
        return latest.current;
    };
    const commit = (patch: Partial<AppSettings>): Promise<void> => {
        const next = change(patch);
        return loadedRef.current ? saveSettings(next) : Promise.resolve();
    };

    // Save settings whenever they change
    const saveSettings = async (newSettings: AppSettings) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    };

    const setHapticsEnabled = (enabled: boolean) => {
        void commit({ hapticsEnabled: enabled });
    };

    const setAutoReschedule = (enabled: boolean) => {
        void commit({ autoReschedule: enabled });
    };

    const setSoundsEnabled = (enabled: boolean) => {
        void commit({ soundsEnabled: enabled });
    };

    const setMusicEnabled = (enabled: boolean) => {
        void commit({ musicEnabled: enabled });
    };

    const setNotificationsEnabled = async (enabled: boolean) => {
        await commit({ notificationsEnabled: enabled })
            .then(() => require('@/lib/notificationService').NotificationService.refreshReminders())
            .catch(() => undefined);
    };

    const setAIPersonality = (personality: PersonalityModeId) => {
        // Reminders already scheduled were written in the old voice; rewrite
        // them once the new one is stored, since that is where they read it.
        commit({ aiPersonality: personality })
            .then(() => require('@/lib/notificationService').NotificationService.refreshHabitReminders())
            .catch(() => undefined);
    };

    const setCardSize = (size: RoadMapCardSize) => {
        void commit({ cardSize: size });
    };

    const setGreetingStyle = (style: GreetingStyle) => {
        void commit({ greetingStyle: style });
    };

    const setUseLocalAI = (enabled: boolean) => {
        void commit({ useLocalAI: enabled });
    };

    const setIsAppLockEnabled = async (enabled: boolean): Promise<boolean> => {
        if (!isLoaded || lockChangePending.current) return false;
        lockChangePending.current = true;
        try {
            if (!(await verifyAppLockChange(enabled))) return false;
            const newSettings = { ...latest.current, isAppLockEnabled: enabled };
            // Show the switch as on only after its preference is durable.
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
            setAppLockVerifiedAt(Date.now());
            latest.current = newSettings;
            setSettings(newSettings);
            return true;
        } finally {
            lockChangePending.current = false;
        }
    };

    const setMotivationStyle = (style: 'gentle' | 'tough_love') => {
        void commit({ motivationStyle: style });
    };

    const setCommunicationStyle = (style: 'empathetic' | 'direct' | 'philosophical') => {
        void commit({ communicationStyle: style });
    };

    return (
        <AppSettingsContext.Provider
            value={{
                ...settings,
                setHapticsEnabled,
                setAutoReschedule,
                setSoundsEnabled,
                setMusicEnabled,
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

/** Whether the timeline moves things for you; on wherever there are no settings yet (tests, early screens). */
export function useAutoReschedule(): boolean {
    return useContext(AppSettingsContext)?.autoReschedule !== false;
}
