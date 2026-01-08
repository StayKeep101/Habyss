import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus, Vibration } from 'react-native';

// ============================================
// Focus Time Context
// Provides global state for Pomodoro timer.
// Prevents multiple timers and tracks total focus time.
// ============================================

interface FocusTimeContextType {
    // Active Timer State
    activeHabitId: string | null;
    activeHabitName: string | null;
    isRunning: boolean;
    isPaused: boolean;
    timeLeft: number; // Seconds remaining
    totalDuration: number; // Total duration set for current session

    // Aggregate Stats
    totalFocusToday: number; // Total seconds focused today
    sessionsToday: number;

    // Actions
    startTimer: (habitId: string, habitName: string, durationSeconds: number) => boolean; // Returns false if another timer is running
    pauseTimer: () => void;
    resumeTimer: () => void;
    stopTimer: () => void;
    addFocusTime: (seconds: number) => void; // For manual adds or adjustments
}

const FocusTimeContext = createContext<FocusTimeContextType | undefined>(undefined);

const STORAGE_KEY_FOCUS_TODAY = 'focus_time_today';
const STORAGE_KEY_SESSIONS_TODAY = 'focus_sessions_today';
const STORAGE_KEY_LAST_DATE = 'focus_last_date';

export const FocusTimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Timer State
    const [activeHabitId, setActiveHabitId] = useState<string | null>(null);
    const [activeHabitName, setActiveHabitName] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [totalDuration, setTotalDuration] = useState(0);

    // Aggregate Stats
    const [totalFocusToday, setTotalFocusToday] = useState(0);
    const [sessionsToday, setSessionsToday] = useState(0);

    // Refs for interval and tracking
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const focusStartRef = useRef<number | null>(null);
    const appState = useRef(AppState.currentState);

    // Load persisted data on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const [focusStr, sessionsStr, lastDateStr] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEY_FOCUS_TODAY),
                    AsyncStorage.getItem(STORAGE_KEY_SESSIONS_TODAY),
                    AsyncStorage.getItem(STORAGE_KEY_LAST_DATE),
                ]);

                const today = new Date().toISOString().split('T')[0];

                if (lastDateStr !== today) {
                    // New day - reset stats
                    setTotalFocusToday(0);
                    setSessionsToday(0);
                    await AsyncStorage.setItem(STORAGE_KEY_LAST_DATE, today);
                    await AsyncStorage.setItem(STORAGE_KEY_FOCUS_TODAY, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_SESSIONS_TODAY, '0');
                } else {
                    setTotalFocusToday(focusStr ? parseInt(focusStr, 10) : 0);
                    setSessionsToday(sessionsStr ? parseInt(sessionsStr, 10) : 0);
                }
            } catch (e) {
                console.error('FocusTimeContext: Failed to load data', e);
            }
        };
        loadData();
    }, []);

    // Save stats when they change
    useEffect(() => {
        AsyncStorage.setItem(STORAGE_KEY_FOCUS_TODAY, totalFocusToday.toString());
    }, [totalFocusToday]);

    useEffect(() => {
        AsyncStorage.setItem(STORAGE_KEY_SESSIONS_TODAY, sessionsToday.toString());
    }, [sessionsToday]);

    // Track time when running
    useEffect(() => {
        if (isRunning && !isPaused) {
            if (!focusStartRef.current) {
                focusStartRef.current = Date.now();
            }

            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        // Timer complete
                        clearInterval(intervalRef.current!);
                        handleTimerComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRunning, isPaused]);

    // Handle app state changes for background notification
    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, [isRunning, activeHabitName]);

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appState.current.match(/active/) && nextAppState === 'background') {
            // App is going to background
            if (isRunning && activeHabitName) {
                // TODO: Schedule local notification here using expo-notifications
                // For now, we'll handle this once expo-notifications is integrated
                console.log('App backgrounded with active timer:', activeHabitName);
            }
        }
        appState.current = nextAppState;
    };

    const handleTimerComplete = useCallback(() => {
        // Vibrate on completion
        Vibration.vibrate([0, 200, 100, 200]);

        // Calculate elapsed time
        if (focusStartRef.current) {
            const elapsed = Math.floor((Date.now() - focusStartRef.current) / 1000);
            setTotalFocusToday(prev => prev + elapsed);
            focusStartRef.current = null;
        }

        // Increment sessions
        setSessionsToday(prev => prev + 1);

        // Reset timer state
        setIsRunning(false);
        setIsPaused(false);
        setActiveHabitId(null);
        setActiveHabitName(null);
        setTimeLeft(0);
        setTotalDuration(0);
    }, []);

    const startTimer = useCallback((habitId: string, habitName: string, durationSeconds: number): boolean => {
        // Prevent starting if another timer is running
        if (isRunning || isPaused) {
            return false;
        }

        setActiveHabitId(habitId);
        setActiveHabitName(habitName);
        setTimeLeft(durationSeconds);
        setTotalDuration(durationSeconds);
        setIsRunning(true);
        setIsPaused(false);
        focusStartRef.current = Date.now();

        return true;
    }, [isRunning, isPaused]);

    const pauseTimer = useCallback(() => {
        if (!isRunning || isPaused) return;

        setIsPaused(true);
        setIsRunning(false); // Stop the interval

        // Track partial focus time
        if (focusStartRef.current) {
            const elapsed = Math.floor((Date.now() - focusStartRef.current) / 1000);
            setTotalFocusToday(prev => prev + elapsed);
            focusStartRef.current = null;
        }
    }, [isRunning, isPaused]);

    const resumeTimer = useCallback(() => {
        if (!isPaused) return;

        setIsPaused(false);
        setIsRunning(true);
        focusStartRef.current = Date.now();
    }, [isPaused]);

    const stopTimer = useCallback(() => {
        // Clear interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Track partial focus time if running/paused
        if (focusStartRef.current) {
            const elapsed = Math.floor((Date.now() - focusStartRef.current) / 1000);
            setTotalFocusToday(prev => prev + elapsed);
            focusStartRef.current = null;
        }

        // Reset all timer state
        setIsRunning(false);
        setIsPaused(false);
        setActiveHabitId(null);
        setActiveHabitName(null);
        setTimeLeft(0);
        setTotalDuration(0);
    }, []);

    const addFocusTime = useCallback((seconds: number) => {
        setTotalFocusToday(prev => prev + seconds);
    }, []);

    return (
        <FocusTimeContext.Provider
            value={{
                activeHabitId,
                activeHabitName,
                isRunning,
                isPaused,
                timeLeft,
                totalDuration,
                totalFocusToday,
                sessionsToday,
                startTimer,
                pauseTimer,
                resumeTimer,
                stopTimer,
                addFocusTime,
            }}
        >
            {children}
        </FocusTimeContext.Provider>
    );
};

export const useFocusTime = (): FocusTimeContextType => {
    const context = useContext(FocusTimeContext);
    if (!context) {
        throw new Error('useFocusTime must be used within a FocusTimeProvider');
    }
    return context;
};
