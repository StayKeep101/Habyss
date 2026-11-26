import React from 'react';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import type { Momentum } from '@/lib/momentum';
import { HomeStatCard } from './HomeStatCard';

/**
 * Kept: of every time a habit was due in the last 30 days, the share you did,
 * and whether that is up or down on the 30 days before. Named for what it
 * counts ("Trend" said nothing about what it measured).
 */
export const MomentumCard: React.FC<{ momentum: Momentum; onPress: () => void }> = ({ momentum, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { rate, delta, comparable } = momentum;
    const up = comparable && delta > 0;
    const down = comparable && delta < 0;
    const tint = up ? colors.success : down ? colors.warning : primary;
    const note = !comparable ? 'habits, 30 days' : delta === 0 ? 'same as last month' : `${up ? '↑' : '↓'} ${Math.abs(delta)}% vs last month`;
    return (
        <HomeStatCard
            icon={up ? 'trending-up' : down ? 'trending-down' : 'pulse'}
            tint={tint}
            value={`${rate}%`}
            label="Kept"
            note={note}
            noteTint={comparable && delta !== 0 ? tint : undefined}
            onPress={onPress}
            accessibilityLabel={`Kept: you did ${rate} percent of your habits when they were due in the last 30 days${comparable ? `, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} on the month before` : ''}`}
        />
    );
};
