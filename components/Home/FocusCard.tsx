import React from 'react';
import { useAccentGradient } from '@/context/AccentContext';
import { useFocusSession } from '@/context/FocusTimeContext';
import { useFocusRecords } from '@/hooks/useFocusRecords';
import { focusSummary } from '@/lib/focusStats';
import { todayKey } from '@/lib/tasks';
import { HomeStatCard } from './HomeStatCard';

/** "45m", "1.5h": short enough for the small card. */
export function focusFigure(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.round(minutes / 6) / 10}h`;
}

/**
 * Focus: how long you have focused today, and nothing more on the card: the
 * week and its days are on the focus stats page it taps through to. Read from
 * the saved sessions (lib/focusStats.ts), the same figure as that page's
 * bars: a running total kept since the app opened carried yesterday over
 * when the app stayed open past midnight.
 */
export function FocusCard({ onPress }: { onPress: () => void }) {
    const { primary } = useAccentGradient();
    const { isRunning } = useFocusSession();
    const records = useFocusRecords();
    const totalFocusToday = focusSummary(records, todayKey()).today;
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
