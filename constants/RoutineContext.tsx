import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useFocusTime, FocusMode } from '@/constants/FocusTimeContext';

// ============================================
// Routine Context — Industry Standard
// Manages routine state, sequencing, and sync
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

export const RoutineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
    const [activeRoutineSession, setActiveRoutineSession] = useState<RoutineSession | null>(null);
    const [currentHabitIndex, setCurrentHabitIndex] = useState(0);
    const [isRoutineRunning, setIsRoutineRunning] = useState(false);

    const focusTime = useFocusTime();

    // ============================================
    // Load routines from Supabase
    // ============================================
    const loadRoutines = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch routines with their habits
            const { data: routineData, error } = await supabase
                .from('routines')
                .select(`
                    *,
                    routine_habits (
                        id,
                        habit_id,
                        position,
                        timer_mode,
                        focus_duration
                    )
                `)
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            if (error) throw error;

            // Fetch habit details for each routine's habits
            const allHabitIds = new Set<string>();
            routineData?.forEach(r => {
                r.routine_habits?.forEach((rh: any) => allHabitIds.add(rh.habit_id));
            });

            let habitDetails: Record<string, any> = {};
            if (allHabitIds.size > 0) {
                const { data: habits } = await supabase
                    .from('habits')
                    .select('id, name, emoji, color')
                    .in('id', Array.from(allHabitIds));

                habits?.forEach(h => { habitDetails[h.id] = h; });
            }

            // Build routine objects
            const mapped: Routine[] = (routineData || []).map(r => ({
                id: r.id,
                userId: r.user_id,
                name: r.name,
                emoji: r.emoji,
                description: r.description,
                timeOfDay: r.time_of_day,
                sortOrder: r.sort_order,
                isActive: r.is_active,
                createdAt: r.created_at,
                habits: (r.routine_habits || [])
                    .sort((a: any, b: any) => a.position - b.position)
                    .map((rh: any) => {
                        const detail = habitDetails[rh.habit_id] || {};
                        return {
                            id: rh.id,
                            routineId: r.id,
                            habitId: rh.habit_id,
                            habitName: detail.name || 'Unknown',
                            habitEmoji: detail.emoji || '📋',
                            habitColor: detail.color || '#6366F1',
                            position: rh.position,
                            timerMode: rh.timer_mode || 'pomodoro',
                            focusDuration: rh.focus_duration || 1500,
                        };
                    }),
            }));

            setRoutines(mapped);
            await AsyncStorage.setItem(STORAGE_KEY_ROUTINES, JSON.stringify(mapped));
        } catch (err) {
            console.error('[Routine] Load error:', err);
            // Fallback to cache
            const cached = await AsyncStorage.getItem(STORAGE_KEY_ROUTINES);
            if (cached) setRoutines(JSON.parse(cached));
        } finally {
            setLoading(false);
        }
    }, []);

    // Load on mount
    useEffect(() => { loadRoutines(); }, [loadRoutines]);

    // ============================================
    // CRUD
    // ============================================
    const createRoutine = useCallback(async (data: {
        name: string;
        emoji: string;
        description?: string;
        timeOfDay: string;
        habits: { habitId: string; timerMode: FocusMode; focusDuration: number }[];
    }): Promise<string | null> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data: routine, error } = await supabase
                .from('routines')
                .insert({
                    user_id: user.id,
                    name: data.name,
                    emoji: data.emoji,
                    description: data.description,
                    time_of_day: data.timeOfDay,
                    sort_order: routines.length,
                })
                .select()
                .single();

            if (error || !routine) throw error;

            // Insert routine habits
            if (data.habits.length > 0) {
                const habitRows = data.habits.map((h, i) => ({
                    routine_id: routine.id,
                    habit_id: h.habitId,
                    position: i,
                    timer_mode: h.timerMode,
                    focus_duration: h.focusDuration,
                }));

                const { error: habError } = await supabase
                    .from('routine_habits')
                    .insert(habitRows);

                if (habError) throw habError;
            }

            await loadRoutines();
            return routine.id;
        } catch (err) {
            console.error('[Routine] Create error:', err);
            return null;
        }
    }, [routines.length, loadRoutines]);

    const updateRoutine = useCallback(async (id: string, data: Partial<Routine>) => {
        try {
            const updateData: any = {};
            if (data.name !== undefined) updateData.name = data.name;
            if (data.emoji !== undefined) updateData.emoji = data.emoji;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.timeOfDay !== undefined) updateData.time_of_day = data.timeOfDay;
            if (data.isActive !== undefined) updateData.is_active = data.isActive;

            await supabase.from('routines').update(updateData).eq('id', id);
            await loadRoutines();
        } catch (err) {
            console.error('[Routine] Update error:', err);
        }
    }, [loadRoutines]);

    const deleteRoutine = useCallback(async (id: string) => {
        try {
            await supabase.from('routines').delete().eq('id', id);
            await loadRoutines();
        } catch (err) {
            console.error('[Routine] Delete error:', err);
        }
    }, [loadRoutines]);

    // ============================================
    // Routine execution
    // ============================================
    const startRoutine = useCallback(async (routine: Routine) => {
        if (routine.habits.length === 0) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Create routine session record
            const { data: session, error } = await supabase
                .from('routine_sessions')
                .insert({
                    user_id: user.id,
                    routine_id: routine.id,
                    total_habits: routine.habits.length,
                })
                .select()
                .single();

            if (error || !session) throw error;

            setActiveRoutine(routine);
            setActiveRoutineSession({
                id: session.id,
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
        } catch (err) {
            console.error('[Routine] Start error:', err);
        }
    }, [focusTime]);

    const completeCurrentHabit = useCallback(() => {
        if (!activeRoutine || !activeRoutineSession) return;

        const nextIndex = currentHabitIndex + 1;
        const newCompleted = activeRoutineSession.completedHabits + 1;

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

        try {
            await supabase
                .from('routine_sessions')
                .update({
                    ended_at: new Date().toISOString(),
                    completed_habits: completedCount,
                    completed,
                })
                .eq('id', activeRoutineSession.id);
        } catch (err) {
            console.error('[Routine] Finish error:', err);
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
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const today = new Date().toISOString().split('T')[0];
            const { data } = await supabase
                .from('routine_sessions')
                .select('routine_id, completed')
                .eq('user_id', user.id)
                .eq('date', today);

            return (data || []).map(d => ({
                routineId: d.routine_id,
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
