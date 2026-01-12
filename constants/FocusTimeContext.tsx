import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus, Vibration } from 'react-native';

import { NotificationService } from '@/lib/notificationService';
import { IntegrationService } from '@/lib/integrationService';
import { HealthKitService } from '@/lib/healthKit';
import { startActivity, updateActivity, stopActivity } from 'expo-live-activity';

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
    bestSessionToday: number; // Longest session today in seconds
    weeklyFocusTotal: number; // Total seconds this week
    monthlyFocusTotal: number; // Total seconds this month
    yearlyFocusTotal: number; // Total seconds this year
    allTimeBest: number; // All-time longest session

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
const STORAGE_KEY_BEST_SESSION_TODAY = 'focus_best_session_today';
const STORAGE_KEY_WEEKLY_TOTAL = 'focus_weekly_total';
const STORAGE_KEY_MONTHLY_TOTAL = 'focus_monthly_total';
const STORAGE_KEY_WEEK_START = 'focus_week_start';
const STORAGE_KEY_MONTH_START = 'focus_month_start';
const STORAGE_KEY_YEARLY_TOTAL = 'focus_yearly_total';
const STORAGE_KEY_YEAR_START = 'focus_year_start';
const STORAGE_KEY_ALL_TIME_BEST = 'focus_all_time_best';

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
    const [bestSessionToday, setBestSessionToday] = useState(0);
    const [weeklyFocusTotal, setWeeklyFocusTotal] = useState(0);
    const [monthlyFocusTotal, setMonthlyFocusTotal] = useState(0);
    const [yearlyFocusTotal, setYearlyFocusTotal] = useState(0);
    const [allTimeBest, setAllTimeBest] = useState(0);

    // Refs for interval and tracking
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const focusStartRef = useRef<number | null>(null);
    const endTimeRef = useRef<number | null>(null); // NEW: Track target end time for precision
    const currentSessionElapsed = useRef<number>(0);
    const appState = useRef(AppState.currentState);
    const activityIdRef = useRef<string | null>(null);
    const [isHealthConnected, setIsHealthConnected] = useState(false);

    // ... (integrations check and persistence loading remain same) ...

    // Track time when running - PRECISION UPDATE
    useEffect(() => {
        if (isRunning && !isPaused && endTimeRef.current) {
            // Immediate update on mount/resume
            const updateTimer = () => {
                if (!endTimeRef.current) return;
                const now = Date.now();
                const remaining = Math.ceil((endTimeRef.current - now) / 1000);

                if (remaining <= 0) {
                    setTimeLeft(0);
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    handleTimerComplete();
                } else {
                    setTimeLeft(remaining);
                }
            };

            // Run immediately once
            updateTimer();

            intervalRef.current = setInterval(updateTimer, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRunning, isPaused]); // Removed activeHabitName dependency to avoid re-renders

    // ... (handleAppStateChange remains same) ...

    // ... (handleAppStateChange remains same) ...

    const handleTimerComplete = useCallback(() => {
        // Logic when timer hits 0 naturally
        if (intervalRef.current) clearInterval(intervalRef.current);

        setIsRunning(false);
        setIsPaused(false);
        setActiveHabitId(null);
        setActiveHabitName(null);
        setTimeLeft(0);
        endTimeRef.current = null;
        focusStartRef.current = null;
        currentSessionElapsed.current = 0;

        // End activity
        if (activityIdRef.current) {
            try {
                stopActivity(activityIdRef.current, {
                    title: 'Session Complete',
                    subtitle: 'Great job!',
                    timerEndDateInMilliseconds: undefined
                } as any);
            } catch (e) { }
            activityIdRef.current = null;
        }

        // Play sound or vibration
        Vibration.vibrate([0, 500, 200, 500]);
        NotificationService.sendCompletionNotification(activeHabitName || 'Focus Session');

        // Update stats
        setSessionsToday(prev => prev + 1);
    }, [activeHabitName]);

    const startTimer = useCallback((habitId: string, habitName: string, durationSeconds: number): boolean => {
        if (isRunning || isPaused) return false;

        setActiveHabitId(habitId);
        setActiveHabitName(habitName);
        setTimeLeft(durationSeconds);
        setTotalDuration(durationSeconds);
        setIsRunning(true);
        setIsPaused(false);

        const now = Date.now();
        focusStartRef.current = now;
        endTimeRef.current = now + (durationSeconds * 1000); // Set absolute end time

        // ... (Live Activity start) ...
        try {
            const attributes = { name: 'Focus Timer' };
            const contentState = {
                title: habitName,
                subtitle: 'Focusing...',
                timerEndDateInMilliseconds: endTimeRef.current,
                progress: 0,
            };

            // Start activity
            (async () => {
                try {
                    // Force cast to any to bypass strict type check for now
                    const id = await startActivity(attributes, contentState as any);
                    if (typeof id === 'string') {
                        activityIdRef.current = id;
                    }
                } catch (e) {
                    console.log('Live Activity Start Error:', e);
                }
            })();

        } catch (e: any) {
            console.log('Live Activity Start Failed', e);
        }

        return true;
    }, [isRunning, isPaused]);

    const pauseTimer = useCallback(() => {
        if (!isRunning || isPaused) return;

        setIsPaused(true);
        setIsRunning(false);

        // Calculate elapsed so far
        if (focusStartRef.current) {
            const elapsed = Math.floor((Date.now() - focusStartRef.current) / 1000);
            currentSessionElapsed.current += elapsed;
            // ... (update totals stats) ...
            focusStartRef.current = null;
        }

        // Clear end time ref as we are paused
        endTimeRef.current = null;

        // ... (Live Activity pause) ...
        if (activityIdRef.current) {
            updateActivity(activityIdRef.current, {
                title: activeHabitName || 'Focus',
                subtitle: 'Paused',
                timerEndDateInMilliseconds: undefined, // remove timer
            } as any);
        }
    }, [isRunning, isPaused, activeHabitName]);

    const resumeTimer = useCallback(() => {
        if (!isPaused) return;

        setIsPaused(false);
        setIsRunning(true);
        const now = Date.now();
        focusStartRef.current = now;

        // Recalculate end time based on timeLeft
        endTimeRef.current = now + (timeLeft * 1000);

        // ... (Live Activity resume) ...
        if (activityIdRef.current && endTimeRef.current) {
            updateActivity(activityIdRef.current, {
                title: activeHabitName || 'Focus',
                subtitle: 'Focusing...',
                timerEndDateInMilliseconds: endTimeRef.current,
            } as any);
        }
    }, [isPaused, timeLeft, activeHabitName]);

    const stopTimer = useCallback(() => {
        // Clear interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Track partial focus time if running/paused
        if (focusStartRef.current) {
            const elapsed = Math.floor((Date.now() - focusStartRef.current) / 1000);
            setTotalFocusToday(prev => prev + elapsed);
            setWeeklyFocusTotal(prev => prev + elapsed);
            setMonthlyFocusTotal(prev => prev + elapsed);
            setYearlyFocusTotal(prev => prev + elapsed);
            focusStartRef.current = null;
        }

        // Reset session tracking
        currentSessionElapsed.current = 0;

        // Reset all timer state
        setIsRunning(false);
        setIsPaused(false);
        setActiveHabitId(null);
        setActiveHabitName(null);
        // End Live Activity
        if (activityIdRef.current) {
            try {
                stopActivity(activityIdRef.current, { title: 'Stopped' } as any);
            } catch (e: any) {
                console.log('End Activity (Stop) Failed', e);
            }
            activityIdRef.current = null;
        }

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
                bestSessionToday,
                weeklyFocusTotal,
                monthlyFocusTotal,
                yearlyFocusTotal,
                allTimeBest,
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
