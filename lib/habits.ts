/**
 * Habit Types and Interfaces
 * Centralized type definitions for the habits system
 */

export type HabitCategory = 'body' | 'wealth' | 'heart' | 'mind' | 'soul' | 'play' | 'health' | 'fitness' | 'work' | 'personal' | 'mindfulness' | 'misc' | 'productivity' | 'learning' | 'creativity' | 'social' | 'family' | 'finance';
export type HabitType = 'build' | 'quit';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';
export type ChartType = 'bar' | 'line';
export type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'free_time';
export type TrackingMethod = 'boolean' | 'numeric';

export interface Habit {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    category: HabitCategory;
    createdAt: string;
    durationMinutes?: number;
    startTime?: string;
    endTime?: string;
    isGoal?: boolean;
    targetDate?: string;
    type: HabitType;
    color: string;
    goalPeriod: GoalPeriod;
    goalValue: number;
    unit: string;
    taskDays: string[];
    reminders: string[];
    chartType: ChartType;
    startDate: string;
    endDate?: string;
    isArchived: boolean;
    showMemo: boolean;
    goalId?: string;
    frequency?: HabitFrequency;
    weekInterval?: number;
    graphStyle?: string;
    timeOfDay?: TimeOfDay;
    trackingMethod?: TrackingMethod;
    ringtone?: string;
    locationReminders?: { name: string; latitude: number; longitude: number; radius?: number }[];
    reminderOffset?: number;
    healthKitMetric?: 'steps' | 'sleep' | 'mindfulness' | 'workout';
    healthKitTarget?: number;
}

export interface HabitCompletion {
    id: string;
    habitId: string;
    date: string;
    value: number;
    memo?: string;
    createdAt: string;
}

export interface HabitStats {
    currentStreak: number;
    bestStreak: number;
    completionRate: number;
    totalCompletions: number;
    totalDaysTracked: number;
}
