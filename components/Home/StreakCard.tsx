import React from 'react';
import { HomeStatCard } from './HomeStatCard';

interface StreakCardProps {
    streak: number;
    completionTier: number; // 0-4
    onPress: () => void;
}

const FLAME_COLORS: Record<number, string[]> = {
    0: ['#F97316', '#FB923C'], // Default orange
    1: ['#F97316', '#FBBF24'], // Orange-yellow
    2: ['#3B82F6', '#60A5FA'], // Blue
    3: ['#8B5CF6', '#A78BFA'], // Purple
    4: ['#EF4444', '#F97316', '#FBBF24', '#22C55E', '#3B82F6', '#8B5CF6'], // Rainbow
};

/**
 * The streak beside Focus and Missed, drawn by the same card (HomeStatCard):
 * the flame on the left in the colour the day has earned, the run beside it.
 */
export const StreakCard: React.FC<StreakCardProps> = ({ streak, completionTier, onPress }) => {
    const flameColors = FLAME_COLORS[completionTier] || FLAME_COLORS[0];
    const flame = completionTier === 4 ? flameColors[flameColors.length - 1] : flameColors[0];
    return (
        <HomeStatCard icon="flame" tint={flame} value={streak} label="Day streak" onPress={onPress}
            accessibilityLabel={`${streak} day streak${completionTier === 4 ? ', a perfect day' : ''}. Open your streak.`} />
    );
};
