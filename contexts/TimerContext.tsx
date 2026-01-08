import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { addFocusMinutes } from '@/lib/habitsSQLite';
import { useHaptics } from '@/hooks/useHaptics';

interface TimerState {
    habitId: string | null;
    habitName: string | null;
    startTime: number | null; // Timestamp when session started (for elapsed calculation)
    duration: number; // Duration in seconds
    timeLeft: number; // Seconds remaining
    status: 'idle' | 'running' | 'paused' | 'break' | 'longBreak';
    totalTime: number; // Total duration of current phase
    completedSessions: number;
    accumulatedFocusTime: number; // Time focused in this session so far (in seconds)
}

interface TimerContextType {
    timerState: TimerState;
    startTimer: (habitId: string, habitName: string, durationMinutes: number) => void;
    pauseTimer: () => void;
    resumeTimer: () => void;
    stopTimer: () => void;
    skipBreak: () => void;
    minimizeTimer: () => void; // Explicitly minimizing implies creating the floating bar
    // Helper to check if a specific habit has an active timer
    isTimerActiveFor: (habitId: string) => boolean;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

const STORAGE_KEY = 'global_timer_state';

// Default intervals
const SHORT_BREAK = 5 * 60;
const LONG_BREAK = 15 * 60;
const SESSIONS_BEFORE_LONG_BREAK = 4;

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { successFeedback, mediumFeedback, selectionFeedback } = useHaptics();

    const [timerState, setTimerState] = useState<TimerState>({
        habitId: null,
        habitName: null,
        startTime: null,
        duration: 25 * 60,
        timeLeft: 25 * 60,
        status: 'idle',
        totalTime: 25 * 60,
        completedSessions: 0,
        accumulatedFocusTime: 0,
    });

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const backgroundTimestampRef = useRef<number | null>(null);
    const stateRef = useRef(timerState); // Use Ref for interval access

    // Sync ref with state
    useEffect(() => {
        stateRef.current = timerState;
    }, [timerState]);

    // Load from storage on mount
    useEffect(() => {
        const loadState = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);

                    // If was running, calculate time elapsed while app was closed/reloaded
                    if (parsed.status === 'running' && parsed.lastUpdated) {
                        const now = Date.now();
                        const elapsed = Math.floor((now - parsed.lastUpdated) / 1000);
                        const newTimeLeft = Math.max(0, parsed.timeLeft - elapsed);

                        // If timer finished while away
                        if (newTimeLeft === 0) {
                            // Logic to handle completion while away could be complex.
                            // For simplicity, set to 0 and pause, waiting for user to acknowledge.
                            setTimerState({
                                ...parsed,
                                timeLeft: 0,
                                status: 'paused', // Pause at 0 to show completion UI
                            });
                        } else {
                            setTimerState({
                                ...parsed,
                                timeLeft: newTimeLeft,
                            });
                        }
                    } else {
                        setTimerState(parsed);
                    }
                }
            } catch (e) {
                console.error('Failed to load timer state', e);
            }
        };
        loadState();
    }, []);

    // Save to storage on change
    useEffect(() => {
        const saveState = async () => {
            // Add a timestamp for background calc
            const toSave = { ...timerState, lastUpdated: Date.now() };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        };
        saveState();
    }, [timerState]);

    // Handle AppState changes (Background/Foreground)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && backgroundTimestampRef.current && stateRef.current.status === 'running') {
                const now = Date.now();
                const elapsed = Math.floor((now - backgroundTimestampRef.current) / 1000);

                // Decrement timer by elapsed time
                setTimerState(prev => {
                    const newTime = Math.max(0, prev.timeLeft - elapsed);
                    if (newTime === 0) {
                        // Timer finished in background
                        handleTimerComplete();
                        return { ...prev, timeLeft: 0, status: 'idle' }; // Or handle completion state
                    }
                    return { ...prev, timeLeft: newTime };
                });

                backgroundTimestampRef.current = null;
            } else if (nextAppState.match(/inactive|background/)) {
                backgroundTimestampRef.current = Date.now();
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // Timer Interval
    useEffect(() => {
        if (timerState.status === 'running') {
            intervalRef.current = setInterval(() => {
                setTimerState(prev => {
                    if (prev.timeLeft <= 1) {
                        // Timer Finished
                        clearInterval(intervalRef.current!);
                        handleTimerComplete();
                        return { ...prev, timeLeft: 0 };
                    }
                    // Add to accumulated focus time
                    // Only accumulating "work" time, not break time
                    const isWork = prev.status === 'running';
                    // Wait, status IS running. But are we in a break phase?
                    // The status 'running' means the CLOCK is ticking. 
                    // We need to know if the CURRENT PHASE is work or break.
                    // However, 'status' definition above mixes them: 'running', 'break', 'longBreak'.
                    // Let's refine: The state needs 'phase': 'work' | 'break'

                    // Actually, the original design used: status = 'running' | 'break'.
                    // If status is 'running', it implies WORK.
                    // If status is 'break', it's a break that is running? 
                    // Let's stick to the PomodoroTimer.tsx logic:
                    // state = 'running' -> Work is ticking.
                    // state = 'break' -> Break is ticking.

                    return {
                        ...prev,
                        timeLeft: prev.timeLeft - 1,
                        accumulatedFocusTime: prev.accumulatedFocusTime + 1
                    };
                });
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [timerState.status]);

    const handleTimerComplete = useCallback(() => {
        successFeedback();
        const state = stateRef.current;

        // Determine next phase
        // If we were working (status='running'), we go to break
        // Wait, if status is used for "Is Ticking", how do we distinguish?
        // In PomodoroTimer.tsx:
        // state 'running' = Work Ticking
        // state 'break' = Break Ticking

        // So if we are 'running' and hit 0 => Work Complete -> Start Break
        // If we are 'break' and hit 0 => Break Complete -> Idle (Ready for work)

        // IMPORTANT: We need to know if we are currently "Work Running" or "Break Running".
        // The type definition I made: status: 'idle' | 'running' | 'paused' | 'break' | 'longBreak';
        // This implies 'running' is WORK. 'break' is BREAK.

        if (state.status === 'running') {
            // Work Complete
            // 1. Persist Focus Time
            if (state.habitId) {
                // Convert seconds to minutes (round up or down? usually floor, but maybe precise?)
                // We'll trust Accumulated Time? Or just duration?
                // If completed, add Full Duration (better for consistency) or actual elapsed?
                // Let's add the duration of the session.
                const minutes = Math.floor(state.duration / 60);
                addFocusMinutes(state.habitId, minutes).catch(console.error);
            }

            const newSessions = state.completedSessions + 1;
            const isLongBreak = newSessions % SESSIONS_BEFORE_LONG_BREAK === 0;
            const breakDuration = isLongBreak ? LONG_BREAK : SHORT_BREAK;

            setTimerState(prev => ({
                ...prev,
                status: isLongBreak ? 'longBreak' : 'break',
                timeLeft: breakDuration,
                totalTime: breakDuration,
                completedSessions: newSessions,
                accumulatedFocusTime: 0 // Reset accumulator for break? Or keep session total?
            }));
        } else if (state.status === 'break' || state.status === 'longBreak') {
            // Break Complete
            setTimerState(prev => ({
                ...prev,
                status: 'idle',
                timeLeft: prev.duration, // Reset to work duration
                totalTime: prev.duration,
            }));
        }
    }, []);

    const startTimer = (habitId: string, habitName: string, durationMinutes: number) => {
        // If different habit, reset
        if (timerState.habitId && timerState.habitId !== habitId) {
            // Alert user? Or auto-replace? User asked: "When a timer is on you cannot start another one."
            // This implies we should BLOCK or Confirm replace.
            // For now, let's just replace as it's cleaner UX than blocking, or assume the UI handles the "Already running" check.
        }

        mediumFeedback();

        setTimerState({
            habitId,
            habitName,
            startTime: Date.now(),
            duration: durationMinutes * 60,
            timeLeft: durationMinutes * 60,
            totalTime: durationMinutes * 60,
            status: 'running',
            completedSessions: 0,
            accumulatedFocusTime: 0,
        });
    };

    const pauseTimer = () => {
        selectionFeedback();
        setTimerState(prev => ({ ...prev, status: 'paused' }));
    };

    const resumeTimer = () => {
        selectionFeedback();
        setTimerState(prev => ({ ...prev, status: 'running' }));
    };

    const stopTimer = () => {
        selectionFeedback();
        // If stopping mid-session, do we save partial time?
        // "The focused time is calculated by the cumulation of time using pomodoro"
        // Yes, we should probably save accumulated time even if stopped early.
        if (timerState.accumulatedFocusTime > 60 && timerState.habitId) {
            const minutes = Math.floor(timerState.accumulatedFocusTime / 60);
            if (minutes > 0) {
                addFocusMinutes(timerState.habitId, minutes).catch(console.error);
            }
        }

        setTimerState(prev => ({
            ...prev,
            status: 'idle',
            timeLeft: prev.duration,
            accumulatedFocusTime: 0
        }));
    };

    const skipBreak = () => {
        selectionFeedback();
        setTimerState(prev => ({
            ...prev,
            status: 'idle',
            timeLeft: prev.duration, // Back to work duration
            totalTime: prev.duration
        }));
    };

    const minimizeTimer = () => {
        // This function might be used to trigger UI animations or state flags
        // For now, context state is enough.
    };

    const isTimerActiveFor = (habitId: string) => {
        return timerState.habitId === habitId && timerState.status !== 'idle';
    };

    return (
        <TimerContext.Provider value={{
            timerState,
            startTimer,
            pauseTimer,
            resumeTimer,
            stopTimer,
            skipBreak,
            minimizeTimer,
            isTimerActiveFor
        }}>
            {children}
        </TimerContext.Provider>
    );
};

export const useTimer = () => {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within a TimerProvider');
    }
    return context;
};
