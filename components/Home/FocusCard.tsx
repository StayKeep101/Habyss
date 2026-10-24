import React from 'react';
import { useAccentGradient } from '@/context/AccentContext';
import { useFocusSession } from '@/context/FocusTimeContext';
import { HomeStatCard } from './HomeStatCard';

/** "45m", "1.5h": short enough for the small card. */
export function focusFigure(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.round(minutes / 6) / 10}h`;
}

/**
 * Focus: how long you have focused today, and this week under it. Taps
 * through to the focus stats. Counted by FocusTimeContext, the one place
 * sessions are recorded.
 */
export function FocusCard({ onPress }: { onPress: () => void }) {
    const { primary } = useAccentGradient();
    const { totalFocusToday, weeklyFocusTotal, isRunning } = useFocusSession();
    return (
        <HomeStatCard
            icon={isRunning ? 'timer' : 'hourglass'}
            tint={primary}
            value={focusFigure(totalFocusToday)}
            label="Focus today"
            note={`${focusFigure(weeklyFocusTotal)} this week`}
            onPress={onPress}
            accessibilityLabel={`Focus: ${Math.round(totalFocusToday / 60)} minutes today, ${Math.round(weeklyFocusTotal / 60)} this week`}
        />
    );
}
