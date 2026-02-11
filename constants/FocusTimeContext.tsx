import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus, Vibration } from 'react-native';

import { NotificationService } from '@/lib/notificationService';
import { IntegrationService } from '@/lib/integrationService';
import { HealthKitService } from '@/lib/healthKit';
import { startActivity, updateActivity, stopActivity } from 'expo-live-activity';
import { supabase } from '@/lib/supabase';

// ============================================
// Focus Time Context - INDUSTRY STANDARD
// Provides global state for Pomodoro timer with
// proper analytics, persistence, and cloud sync.
// ============================================

// Focus session record type
interface FocusSession {
    id?: string;
    habitId: string;
    habitName: string;
    startedAt: Date;
    endedAt?: Date;
    plannedDuration: number; // seconds
    actualDuration: number; // seconds
    completed: boolean; // true if timer reached 0, false if stopped early
}

interface FocusTimeContextType {
    // Active Timer State
    activeHabitId: string | null;
    activeHabitName: string | null;
    isRunning: boolean;
    isPaused: boolean;
    timeLeft: number; // Seconds remaining
    totalDuration: number; // Total duration set for current session

    // Aggregate Stats (Industry Standard)
    totalFocusToday: number; // Total seconds focused today
    sessionsToday: number;
    bestSessionToday: number; // Longest session today in seconds
    weeklyFocusTotal: number; // Total seconds this week
    monthlyFocusTotal: number; // Total seconds this month
    yearlyFocusTotal: number; // Total seconds this year
    allTimeBest: number; // All-time longest session

    // NEW: Industry-Standard Metrics
    activeDaysThisWeek: number; // Days with at least one session
    dailyAverageAccurate: number; // Weekly total / actual active days
    weeklyMovingAverage: number; // 7-day smoothed trend
    productivityEfficiency: number; // % of sessions completed (not stopped early)
    completedSessionsThisWeek: number;
    totalSessionsThisWeek: number;

    // Actions
    startTimer: (habitId: string, habitName: string, durationSeconds: number) => boolean;
    pauseTimer: () => void;
    resumeTimer: () => void;
    stopTimer: () => void;
    addFocusTime: (seconds: number) => void;
    refreshStats: () => Promise<void>; // NEW: Manual refresh
}

const FocusTimeContext = createContext<FocusTimeContextType | undefined>(undefined);

// AsyncStorage keys for local cache
const STORAGE_KEY_FOCUS_TODAY = 'focus_time_today';
const STORAGE_KEY_SESSIONS_TODAY = 'focus_sessions_today';
const STORAGE_KEY_COMPLETED_SESSIONS_TODAY = 'focus_completed_sessions_today';
const STORAGE_KEY_LAST_DATE = 'focus_last_date';
const STORAGE_KEY_BEST_SESSION_TODAY = 'focus_best_session_today';
const STORAGE_KEY_WEEKLY_TOTAL = 'focus_weekly_total';
const STORAGE_KEY_MONTHLY_TOTAL = 'focus_monthly_total';
const STORAGE_KEY_WEEK_START = 'focus_week_start';
const STORAGE_KEY_MONTH_START = 'focus_month_start';
const STORAGE_KEY_YEARLY_TOTAL = 'focus_yearly_total';
const STORAGE_KEY_YEAR_START = 'focus_year_start';
const STORAGE_KEY_ALL_TIME_BEST = 'focus_all_time_best';
const STORAGE_KEY_ACTIVE_DAYS_WEEK = 'focus_active_days_week';
const STORAGE_KEY_COMPLETED_SESSIONS_WEEK = 'focus_completed_sessions_week';
const STORAGE_KEY_TOTAL_SESSIONS_WEEK = 'focus_total_sessions_week';

// Helper: Get current user ID
const getUserId = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
};

// Helper: Get today's date string (YYYY-MM-DD)
const getTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Helper: Get week start date (Monday)
const getWeekStartString = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
};

// Helper: Get month start date
const getMonthStartString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

// Helper: Get year start date
const getYearStartString = () => {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
};

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
    const [completedSessionsToday, setCompletedSessionsToday] = useState(0);
    const [bestSessionToday, setBestSessionToday] = useState(0);
    const [weeklyFocusTotal, setWeeklyFocusTotal] = useState(0);
    const [monthlyFocusTotal, setMonthlyFocusTotal] = useState(0);
    const [yearlyFocusTotal, setYearlyFocusTotal] = useState(0);
    const [allTimeBest, setAllTimeBest] = useState(0);

    // NEW: Industry-Standard Stats
    const [activeDaysThisWeek, setActiveDaysThisWeek] = useState(0);
    const [completedSessionsThisWeek, setCompletedSessionsThisWeek] = useState(0);
    const [totalSessionsThisWeek, setTotalSessionsThisWeek] = useState(0);

    // Refs for interval and tracking
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const focusStartRef = useRef<number | null>(null);
    const endTimeRef = useRef<number | null>(null);
    const currentSessionRef = useRef<FocusSession | null>(null);
    const appState = useRef(AppState.currentState);
    const activityIdRef = useRef<string | null>(null);
    const todaySessionRecordedRef = useRef(false); // Track if we recorded a session for today's active days

    // DERIVED: Industry-Standard Calculations
    const dailyAverageAccurate = activeDaysThisWeek > 0
        ? Math.round(weeklyFocusTotal / activeDaysThisWeek)
        : 0;

    const productivityEfficiency = totalSessionsThisWeek > 0
        ? Math.round((completedSessionsThisWeek / totalSessionsThisWeek) * 100)
        : 0;

    // Moving average approximation (7-day smoothed based on weekly total / 7)
    // For true moving average, we'd need daily history which is persisted in DB
    const weeklyMovingAverage = Math.round(weeklyFocusTotal / 7);

    // ============================================
    // Persistence: Load from AsyncStorage on mount
    // ============================================
    useEffect(() => {
        const loadStats = async () => {
            try {
                const today = getTodayString();
                const weekStart = getWeekStartString();
                const monthStart = getMonthStartString();
                const yearStart = getYearStartString();

                // Check if we need to reset daily stats
                const lastDate = await AsyncStorage.getItem(STORAGE_KEY_LAST_DATE);
                if (lastDate !== today) {
                    // Reset daily stats
                    setTotalFocusToday(0);
                    setSessionsToday(0);
                    setCompletedSessionsToday(0);
                    setBestSessionToday(0);
                    todaySessionRecordedRef.current = false;
                    await AsyncStorage.setItem(STORAGE_KEY_FOCUS_TODAY, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_SESSIONS_TODAY, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_COMPLETED_SESSIONS_TODAY, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_BEST_SESSION_TODAY, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_LAST_DATE, today);
                } else {
                    // Load daily stats
                    const focusToday = await AsyncStorage.getItem(STORAGE_KEY_FOCUS_TODAY);
                    const sessions = await AsyncStorage.getItem(STORAGE_KEY_SESSIONS_TODAY);
                    const completedSessions = await AsyncStorage.getItem(STORAGE_KEY_COMPLETED_SESSIONS_TODAY);
                    const bestToday = await AsyncStorage.getItem(STORAGE_KEY_BEST_SESSION_TODAY);
                    if (focusToday) setTotalFocusToday(parseInt(focusToday, 10));
                    if (sessions) setSessionsToday(parseInt(sessions, 10));
                    if (completedSessions) setCompletedSessionsToday(parseInt(completedSessions, 10));
                    if (bestToday) setBestSessionToday(parseInt(bestToday, 10));
                    // Mark that we have sessions today
                    if (sessions && parseInt(sessions, 10) > 0) {
                        todaySessionRecordedRef.current = true;
                    }
                }

                // Check if we need to reset weekly stats
                const storedWeekStart = await AsyncStorage.getItem(STORAGE_KEY_WEEK_START);
                if (storedWeekStart !== weekStart) {
                    setWeeklyFocusTotal(0);
                    setActiveDaysThisWeek(0);
                    setCompletedSessionsThisWeek(0);
                    setTotalSessionsThisWeek(0);
                    await AsyncStorage.setItem(STORAGE_KEY_WEEKLY_TOTAL, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_DAYS_WEEK, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_COMPLETED_SESSIONS_WEEK, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_TOTAL_SESSIONS_WEEK, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_WEEK_START, weekStart);
                } else {
                    const weekly = await AsyncStorage.getItem(STORAGE_KEY_WEEKLY_TOTAL);
                    const activeDays = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_DAYS_WEEK);
                    const completedWeek = await AsyncStorage.getItem(STORAGE_KEY_COMPLETED_SESSIONS_WEEK);
                    const totalWeek = await AsyncStorage.getItem(STORAGE_KEY_TOTAL_SESSIONS_WEEK);
                    if (weekly) setWeeklyFocusTotal(parseInt(weekly, 10));
                    if (activeDays) setActiveDaysThisWeek(parseInt(activeDays, 10));
                    if (completedWeek) setCompletedSessionsThisWeek(parseInt(completedWeek, 10));
                    if (totalWeek) setTotalSessionsThisWeek(parseInt(totalWeek, 10));
                }

                // Check if we need to reset monthly stats
                const storedMonthStart = await AsyncStorage.getItem(STORAGE_KEY_MONTH_START);
                if (storedMonthStart !== monthStart) {
                    setMonthlyFocusTotal(0);
                    await AsyncStorage.setItem(STORAGE_KEY_MONTHLY_TOTAL, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_MONTH_START, monthStart);
                } else {
                    const monthly = await AsyncStorage.getItem(STORAGE_KEY_MONTHLY_TOTAL);
                    if (monthly) setMonthlyFocusTotal(parseInt(monthly, 10));
                }

                // Check if we need to reset yearly stats
                const storedYearStart = await AsyncStorage.getItem(STORAGE_KEY_YEAR_START);
                if (storedYearStart !== yearStart) {
                    setYearlyFocusTotal(0);
                    await AsyncStorage.setItem(STORAGE_KEY_YEARLY_TOTAL, '0');
                    await AsyncStorage.setItem(STORAGE_KEY_YEAR_START, yearStart);
                } else {
                    const yearly = await AsyncStorage.getItem(STORAGE_KEY_YEARLY_TOTAL);
                    if (yearly) setYearlyFocusTotal(parseInt(yearly, 10));
                }

                // Load all-time best (never resets)
                const allBest = await AsyncStorage.getItem(STORAGE_KEY_ALL_TIME_BEST);
                if (allBest) setAllTimeBest(parseInt(allBest, 10));

            } catch (e) {
                console.error('Failed to load focus stats:', e);
            }
        };

        loadStats();
    }, []);

    // ============================================
    // Save session to database (Supabase) - fire and forget
    // ============================================
    const saveFocusSession = useCallback(async (session: FocusSession) => {
        try {
            const userId = await getUserId();
            if (!userId) return;

            await supabase.from('focus_sessions').insert({
                user_id: userId,
                habit_id: session.habitId,
                started_at: session.startedAt.toISOString(),
                ended_at: session.endedAt?.toISOString() || new Date().toISOString(),
                planned_duration: session.plannedDuration,
                actual_duration: session.actualDuration,
                completed: session.completed,
                date: getTodayString(),
            });
        } catch (e) {
            console.log('Failed to save focus session to DB:', e);
        }
    }, []);

    // ============================================
    // Update stats and persist to AsyncStorage
    // ============================================
    const updateStats = useCallback(async (duration: number, completed: boolean) => {
        // Update local state
        setTotalFocusToday(prev => {
            const next = prev + duration;
            AsyncStorage.setItem(STORAGE_KEY_FOCUS_TODAY, String(next));
            return next;
        });

        setSessionsToday(prev => {
            const next = prev + 1;
            AsyncStorage.setItem(STORAGE_KEY_SESSIONS_TODAY, String(next));
            return next;
        });

        if (completed) {
            setCompletedSessionsToday(prev => {
                const next = prev + 1;
                AsyncStorage.setItem(STORAGE_KEY_COMPLETED_SESSIONS_TODAY, String(next));
                return next;
            });
        }

        // Best session today (only for completed sessions)
        if (completed) {
            setBestSessionToday(prev => {
                if (duration > prev) {
                    AsyncStorage.setItem(STORAGE_KEY_BEST_SESSION_TODAY, String(duration));
                    return duration;
                }
                return prev;
            });

            // All-time best
            setAllTimeBest(prev => {
                if (duration > prev) {
                    AsyncStorage.setItem(STORAGE_KEY_ALL_TIME_BEST, String(duration));
                    return duration;
                }
                return prev;
            });
        }

        // Weekly stats
        setWeeklyFocusTotal(prev => {
            const next = prev + duration;
            AsyncStorage.setItem(STORAGE_KEY_WEEKLY_TOTAL, String(next));
            return next;
        });

        setTotalSessionsThisWeek(prev => {
            const next = prev + 1;
            AsyncStorage.setItem(STORAGE_KEY_TOTAL_SESSIONS_WEEK, String(next));
            return next;
        });

        if (completed) {
            setCompletedSessionsThisWeek(prev => {
                const next = prev + 1;
                AsyncStorage.setItem(STORAGE_KEY_COMPLETED_SESSIONS_WEEK, String(next));
                return next;
            });
        }

        // Active days tracking - only increment once per day
        if (!todaySessionRecordedRef.current) {
            todaySessionRecordedRef.current = true;
            setActiveDaysThisWeek(prev => {
                const next = prev + 1;
                AsyncStorage.setItem(STORAGE_KEY_ACTIVE_DAYS_WEEK, String(next));
                return next;
            });
        }

        // Monthly stats
        setMonthlyFocusTotal(prev => {
            const next = prev + duration;
            AsyncStorage.setItem(STORAGE_KEY_MONTHLY_TOTAL, String(next));
            return next;
        });

        // Yearly stats
        setYearlyFocusTotal(prev => {
            const next = prev + duration;
            AsyncStorage.setItem(STORAGE_KEY_YEARLY_TOTAL, String(next));
            return next;
        });
    }, []);

    // ============================================
    // Timer tick effect
    // ============================================
    useEffect(() => {
        if (isRunning && !isPaused && endTimeRef.current) {
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
    }, [isRunning, isPaused]);

    // ============================================
    // Timer complete handler
    // ============================================
    const handleTimerComplete = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        const session = currentSessionRef.current;
        const duration = session?.plannedDuration || totalDuration;

        // Update stats with COMPLETED = true
        updateStats(duration, true);

        // Save session to DB
        if (session) {
            session.endedAt = new Date();
            session.actualDuration = duration;
            session.completed = true;
            saveFocusSession(session);
        }

        // Reset state
        setIsRunning(false);
        setIsPaused(false);
        setActiveHabitId(null);
        setActiveHabitName(null);
        setTimeLeft(0);
        endTimeRef.current = null;
        focusStartRef.current = null;
        currentSessionRef.current = null;

        // End Live Activity
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

        // Haptic + Notification
        Vibration.vibrate([0, 500, 200, 500]);
        NotificationService.sendCompletionNotification(session?.habitName || 'Focus Session');
    }, [totalDuration, updateStats, saveFocusSession]);

    // ============================================
    // Start Timer
    // ============================================
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
        endTimeRef.current = now + (durationSeconds * 1000);

        // Create session record
        currentSessionRef.current = {
            habitId,
            habitName,
            startedAt: new Date(now),
            plannedDuration: durationSeconds,
            actualDuration: 0,
            completed: false,
        };

        // Start Live Activity
        try {
            const attributes = {
                name: 'Focus Timer',
                totalDurationSeconds: durationSeconds,
                backgroundColor: '#0A0F14',
                titleColor: '#8BADD6',
                progressViewTint: '#8BADD6',
            };
            const contentState = {
                title: habitName,
                subtitle: 'Focusing...',
                timerEndDateInMilliseconds: endTimeRef.current,
                progress: 0,
            };

            (async () => {
                try {
                    const id = await startActivity(attributes as any, contentState as any);
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

    // ============================================
    // Pause Timer
    // ============================================
    const pauseTimer = useCallback(() => {
        if (!isRunning || isPaused) return;

        setIsPaused(true);
        setIsRunning(false);

        // Track elapsed time
        if (focusStartRef.current && currentSessionRef.current) {
            const elapsed = Math.floor((Date.now() - focusStartRef.current) / 1000);
            currentSessionRef.current.actualDuration += elapsed;
            focusStartRef.current = null;
        }

        endTimeRef.current = null;

        // Update Live Activity
        if (activityIdRef.current) {
            updateActivity(activityIdRef.current, {
                title: activeHabitName || 'Focus',
                subtitle: 'Paused',
                timerEndDateInMilliseconds: undefined,
            } as any);
        }
    }, [isRunning, isPaused, activeHabitName]);

    // ============================================
    // Resume Timer
    // ============================================
    const resumeTimer = useCallback(() => {
        if (!isPaused) return;

        setIsPaused(false);
        setIsRunning(true);
        const now = Date.now();
        focusStartRef.current = now;
        endTimeRef.current = now + (timeLeft * 1000);

        // Update Live Activity
        if (activityIdRef.current && endTimeRef.current) {
            updateActivity(activityIdRef.current, {
                title: activeHabitName || 'Focus',
                subtitle: 'Focusing...',
                timerEndDateInMilliseconds: endTimeRef.current,
            } as any);
        }
    }, [isPaused, timeLeft, activeHabitName]);

    // ============================================
    // Stop Timer (early termination)
    // ============================================
    const stopTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        const session = currentSessionRef.current;
        let actualDuration = session?.actualDuration || 0;

        // Add any elapsed time since last pause/start
        if (focusStartRef.current) {
            const elapsed = Math.floor((Date.now() - focusStartRef.current) / 1000);
            actualDuration += elapsed;
            focusStartRef.current = null;
        }

        // Only record if we actually focused for some time
        if (actualDuration > 0) {
            // Update stats with COMPLETED = false (stopped early)
            updateStats(actualDuration, false);

            // Save session to DB
            if (session) {
                session.endedAt = new Date();
                session.actualDuration = actualDuration;
                session.completed = false;
                saveFocusSession(session);
            }
        }

        // Reset all state
        setIsRunning(false);
        setIsPaused(false);
        setActiveHabitId(null);
        setActiveHabitName(null);
        setTimeLeft(0);
        setTotalDuration(0);
        endTimeRef.current = null;
        currentSessionRef.current = null;

        // End Live Activity
        if (activityIdRef.current) {
            try {
                stopActivity(activityIdRef.current, { title: 'Stopped' } as any);
            } catch (e: any) {
                console.log('End Activity (Stop) Failed', e);
            }
            activityIdRef.current = null;
        }
    }, [updateStats, saveFocusSession]);

    // ============================================
    // Manual focus time add
    // ============================================
    const addFocusTime = useCallback((seconds: number) => {
        updateStats(seconds, true);
    }, [updateStats]);

    // ============================================
    // Refresh stats from DB (for sync)
    // ============================================
    const refreshStats = useCallback(async () => {
        try {
            const userId = await getUserId();
            if (!userId) return;

            const { data, error } = await supabase
                .from('focus_stats')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error || !data) return;

            // Update state from DB
            setTotalFocusToday(data.today_total || 0);
            setSessionsToday(data.today_sessions || 0);
            setBestSessionToday(data.today_best || 0);
            setWeeklyFocusTotal(data.week_total || 0);
            setActiveDaysThisWeek(data.week_active_days || 0);
            setTotalSessionsThisWeek(data.week_sessions || 0);
            setCompletedSessionsThisWeek(data.week_completed_sessions || 0);
            setMonthlyFocusTotal(data.month_total || 0);
            setYearlyFocusTotal(data.year_total || 0);
            setAllTimeBest(data.all_time_best || 0);

            // Persist to AsyncStorage for offline access
            await AsyncStorage.setItem(STORAGE_KEY_FOCUS_TODAY, String(data.today_total || 0));
            await AsyncStorage.setItem(STORAGE_KEY_WEEKLY_TOTAL, String(data.week_total || 0));
            await AsyncStorage.setItem(STORAGE_KEY_MONTHLY_TOTAL, String(data.month_total || 0));
            await AsyncStorage.setItem(STORAGE_KEY_YEARLY_TOTAL, String(data.year_total || 0));
            await AsyncStorage.setItem(STORAGE_KEY_ALL_TIME_BEST, String(data.all_time_best || 0));
        } catch (e) {
            console.log('Failed to refresh focus stats:', e);
        }
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
                // NEW: Industry-Standard Metrics
                activeDaysThisWeek,
                dailyAverageAccurate,
                weeklyMovingAverage,
                productivityEfficiency,
                completedSessionsThisWeek,
                totalSessionsThisWeek,
                // Actions
                startTimer,
                pauseTimer,
                resumeTimer,
                stopTimer,
                addFocusTime,
                refreshStats,
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
