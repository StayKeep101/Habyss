import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { getLocalUserId } from '@/lib/localUser';
import { toggleCompletion, getHabits } from '@/lib/habitsSQLite';
import { useFocusTime, FocusMode } from '@/constants/FocusTimeContext';

// ============================================
// Routine Context — Local-Only (SQLite/AsyncStorage)
// Cloud sync gated behind premium tier
// ============================================

export interface RoutineHabit {
    id: string;
    routineId: string;
    habitId: string;
    habitName: string;
    habitEmoji: string;
    habitColor: string;
    position: number;
    timerMode: FocusMode;
    focusDuration: number; // seconds
}

export interface Routine {
    id: string;
    userId: string;
    name: string;
    emoji: string;
    description?: string;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
    sortOrder: number;
    isActive: boolean;
    habits: RoutineHabit[];
    createdAt: string;
}

export interface RoutineSession {
    id: string;
    routineId: string;
    startedAt: Date;
    endedAt?: Date;
    totalHabits: number;
    completedHabits: number;
    totalFocusTime: number;
    completed: boolean;
}

interface RoutineContextType {
    // Data
    routines: Routine[];
    loading: boolean;

    // Active routine state
    activeRoutine: Routine | null;
    activeRoutineSession: RoutineSession | null;
    currentHabitIndex: number;
    isRoutineRunning: boolean;

    // Actions
    loadRoutines: () => Promise<void>;
    createRoutine: (data: {
        name: string;
        emoji: string;
        description?: string;
        timeOfDay: string;
        habits: { habitId: string; timerMode: FocusMode; focusDuration: number }[];
    }) => Promise<string | null>;
    updateRoutine: (id: string, data: Partial<Routine>) => Promise<void>;
    deleteRoutine: (id: string) => Promise<void>;
    startRoutine: (routine: Routine) => Promise<void>;
    completeCurrentHabit: () => void;
    skipCurrentHabit: () => void;
    endRoutine: () => Promise<void>;

    // Helpers
    getRoutinesForTimeOfDay: (time: string) => Routine[];
    getTodayRoutineSessions: () => Promise<{ routineId: string; completed: boolean }[]>;
}

const RoutineContext = createContext<RoutineContextType | undefined>(undefined);
const STORAGE_KEY_ROUTINES = 'habyss_routines_cache';
const STORAGE_KEY_ROUTINE_SESSIONS = 'habyss_routine_sessions';

// Generate a simple UUID
const generateId = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const RoutineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
    const [activeRoutineSession, setActiveRoutineSession] = useState<RoutineSession | null>(null);
    const [currentHabitIndex, setCurrentHabitIndex] = useState(0);
    const [isRoutineRunning, setIsRoutineRunning] = useState(false);

    const focusTime = useFocusTime();

    // ============================================
    // Load routines from AsyncStorage
    // ============================================
    const loadRoutines = useCallback(async () => {
        try {
            setLoading(true);
            const cached = await AsyncStorage.getItem(STORAGE_KEY_ROUTINES);
            if (cached) {
                setRoutines(JSON.parse(cached));
            }
        } catch (err) {
            console.error('[Routine] Load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load on mount
    useEffect(() => { loadRoutines(); }, [loadRoutines]);

    // Helper to persist routines
    const persistRoutines = async (updated: Routine[]) => {
        setRoutines(updated);
        await AsyncStorage.setItem(STORAGE_KEY_ROUTINES, JSON.stringify(updated));
    };

    // ============================================
    // CRUD (AsyncStorage-backed, local-only)
    // ============================================
    const createRoutine = useCallback(async (data: {
        name: string;
        emoji: string;
        description?: string;
        timeOfDay: string;
        habits: { habitId: string; timerMode: FocusMode; focusDuration: number }[];
    }): Promise<string | null> => {
        try {
            const userId = await getLocalUserId();
            const routineId = generateId();

            // Fetch habit details from SQLite for display
            const allHabits = await getHabits();
            const habitMap: Record<string, any> = {};
            allHabits.forEach(h => { habitMap[h.id] = h; });

            const routineHabits: RoutineHabit[] = data.habits.map((h, i) => {
                const detail = habitMap[h.habitId] || {};
                return {
                    id: generateId(),
                    routineId,
                    habitId: h.habitId,
                    habitName: detail.name || 'Unknown',
                    habitEmoji: detail.icon || '📋',
                    habitColor: detail.color || '#6366F1',
                    position: i,
                    timerMode: h.timerMode,
                    focusDuration: h.focusDuration,
                };
            });

            const newRoutine: Routine = {
                id: routineId,
                userId,
                name: data.name,
                emoji: data.emoji,
                description: data.description,
                timeOfDay: data.timeOfDay as any,
                sortOrder: routines.length,
                isActive: true,
                habits: routineHabits,
                createdAt: new Date().toISOString(),
            };

            await persistRoutines([...routines, newRoutine]);
            return routineId;
        } catch (err) {
            console.error('[Routine] Create error:', err);
            return null;
        }
    }, [routines]);

    const updateRoutine = useCallback(async (id: string, data: Partial<Routine>) => {
        try {
            const updated = routines.map(r => {
                if (r.id !== id) return r;
                return { ...r, ...data };
            });
            await persistRoutines(updated);
        } catch (err) {
            console.error('[Routine] Update error:', err);
        }
    }, [routines]);

    const deleteRoutine = useCallback(async (id: string) => {
        try {
            const updated = routines.filter(r => r.id !== id);
            await persistRoutines(updated);
        } catch (err) {
            console.error('[Routine] Delete error:', err);
        }
    }, [routines]);

    // ============================================
    // Routine execution (local session tracking)
    // ============================================
    const startRoutine = useCallback(async (routine: Routine) => {
        if (routine.habits.length === 0) return;

        const sessionId = generateId();

        setActiveRoutine(routine);
        setActiveRoutineSession({
            id: sessionId,
            routineId: routine.id,
            startedAt: new Date(),
            totalHabits: routine.habits.length,
            completedHabits: 0,
            totalFocusTime: 0,
            completed: false,
        });
        setCurrentHabitIndex(0);
        setIsRoutineRunning(true);

        // Start timer for first habit
        const firstHabit = routine.habits[0];
        focusTime.startTimer(
            firstHabit.habitId,
            firstHabit.habitName,
            firstHabit.focusDuration,
            firstHabit.timerMode
        );
    }, [focusTime]);

    const completeCurrentHabit = useCallback(() => {
        if (!activeRoutine || !activeRoutineSession) return;

        const currentHabit = activeRoutine.habits[currentHabitIndex];
        const nextIndex = currentHabitIndex + 1;
        const newCompleted = activeRoutineSession.completedHabits + 1;

        // Mark the habit as complete in SQLite
        const todayStr = new Date().toISOString().split('T')[0];
        if (currentHabit) {
            toggleCompletion(currentHabit.habitId, todayStr).catch(console.error);
            // Emit event so home screen updates
            DeviceEventEmitter.emit('habit_completion_updated', {
                habitId: currentHabit.habitId,
                date: todayStr,
                completed: true,
            });
        }

        setActiveRoutineSession(prev => prev ? {
            ...prev,
            completedHabits: newCompleted,
        } : null);

        if (nextIndex < activeRoutine.habits.length) {
            // Advance to next habit
            setCurrentHabitIndex(nextIndex);
            const nextHabit = activeRoutine.habits[nextIndex];
            setTimeout(() => {
                focusTime.startTimer(
                    nextHabit.habitId,
                    nextHabit.habitName,
                    nextHabit.focusDuration,
                    nextHabit.timerMode
                );
            }, 500);
        } else {
            // Routine complete!
            finishRoutine(true, newCompleted);
        }
    }, [activeRoutine, activeRoutineSession, currentHabitIndex, focusTime]);

    const skipCurrentHabit = useCallback(() => {
        if (!activeRoutine || !activeRoutineSession) return;

        const nextIndex = currentHabitIndex + 1;

        if (nextIndex < activeRoutine.habits.length) {
            setCurrentHabitIndex(nextIndex);
            const nextHabit = activeRoutine.habits[nextIndex];
            setTimeout(() => {
                focusTime.startTimer(
                    nextHabit.habitId,
                    nextHabit.habitName,
                    nextHabit.focusDuration,
                    nextHabit.timerMode
                );
            }, 500);
        } else {
            finishRoutine(false, activeRoutineSession.completedHabits);
        }
    }, [activeRoutine, activeRoutineSession, currentHabitIndex, focusTime]);

    const finishRoutine = async (completed: boolean, completedCount: number) => {
        if (!activeRoutineSession) return;

        // Save session to AsyncStorage
        try {
            const sessionsRaw = await AsyncStorage.getItem(STORAGE_KEY_ROUTINE_SESSIONS);
            const sessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];
            sessions.push({
                id: activeRoutineSession.id,
                routineId: activeRoutineSession.routineId,
                startedAt: activeRoutineSession.startedAt,
                endedAt: new Date().toISOString(),
                completedHabits: completedCount,
                totalHabits: activeRoutineSession.totalHabits,
                completed,
                date: new Date().toISOString().split('T')[0],
            });
            // Keep only last 90 days of sessions
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 90);
            const filtered = sessions.filter((s: any) => new Date(s.date) >= cutoff);
            await AsyncStorage.setItem(STORAGE_KEY_ROUTINE_SESSIONS, JSON.stringify(filtered));
        } catch (err) {
            console.error('[Routine] Finish save error:', err);
        }

        setActiveRoutine(null);
        setActiveRoutineSession(null);
        setCurrentHabitIndex(0);
        setIsRoutineRunning(false);
    };

    const endRoutine = useCallback(async () => {
        focusTime.stopTimer();
        await finishRoutine(false, activeRoutineSession?.completedHabits || 0);
    }, [focusTime, activeRoutineSession]);

    // ============================================
    // Helpers
    // ============================================
    const getRoutinesForTimeOfDay = useCallback((time: string) => {
        return routines.filter(r => r.timeOfDay === time || r.timeOfDay === 'anytime');
    }, [routines]);

    const getTodayRoutineSessions = useCallback(async () => {
        try {
            const sessionsRaw = await AsyncStorage.getItem(STORAGE_KEY_ROUTINE_SESSIONS);
            if (!sessionsRaw) return [];
            const sessions = JSON.parse(sessionsRaw);
            const today = new Date().toISOString().split('T')[0];

            return sessions
                .filter((s: any) => s.date === today)
                .map((d: any) => ({
                    routineId: d.routineId,
                    completed: d.completed,
                }));
        } catch {
            return [];
        }
    }, []);

    return (
        <RoutineContext.Provider value={{
            routines,
            loading,
            activeRoutine,
            activeRoutineSession,
            currentHabitIndex,
            isRoutineRunning,
            loadRoutines,
            createRoutine,
            updateRoutine,
            deleteRoutine,
            startRoutine,
            completeCurrentHabit,
            skipCurrentHabit,
            endRoutine,
            getRoutinesForTimeOfDay,
            getTodayRoutineSessions,
        }}>
            {children}
        </RoutineContext.Provider>
    );
};

export const useRoutines = (): RoutineContextType => {
    const context = useContext(RoutineContext);
    if (!context) {
        throw new Error('useRoutines must be used within a RoutineProvider');
    }
    return context;
};
