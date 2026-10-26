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
 * Focus: how long you have focused today, and nothing more on the card: the
 * week and its days are on the focus stats page it taps through to. Counted by FocusTimeContext, the one place
 * sessions are recorded.
 */
export function FocusCard({ onPress }: { onPress: () => void }) {
    const { primary } = useAccentGradient();
    const { totalFocusToday, isRunning } = useFocusSession();
    return (
        <HomeStatCard
            icon={isRunning ? 'timer' : 'hourglass'}
            tint={primary}
            value={focusFigure(totalFocusToday)}
            label="Focus today"
            onPress={onPress}
            accessibilityLabel={`Focus: ${Math.round(totalFocusToday / 60)} minutes today`}
        />
    );
}
