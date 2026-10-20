import React from 'react';
import { useTokens } from '@/hooks/useTokens';
import type { Missed } from '@/lib/missed';
import { HomeStatCard } from './HomeStatCard';

/**
 * Missed: how many habits and tasks went undone in the last 7 days, and
 * whether that is more than the week before (falling behind) or fewer
 * (catching up). Opens the day-by-day list.
 */
export const MissedCard: React.FC<{ missed: Missed; onPress: () => void }> = ({ missed, onPress }) => {
    const t = useTokens();
    const { thisWeek, lastWeek } = missed;
    const worse = thisWeek > lastWeek;
    const note = thisWeek === 0 ? 'none this week' : thisWeek === lastWeek ? 'same as last week' : `${worse ? '↑' : '↓'} from ${lastWeek} last week`;
    const tint = thisWeek === 0 || !worse ? t.color.success : t.color.warning;
    return (
        <HomeStatCard icon={thisWeek === 0 ? 'checkmark-done' : 'calendar-clear'} tint={tint} value={thisWeek} label="Missed"
            note={note} noteTint={thisWeek === lastWeek ? undefined : tint} onPress={onPress}
            accessibilityLabel={`Missed: ${thisWeek} habits and tasks not done in the last 7 days, ${lastWeek} the week before`} />
    );
};
