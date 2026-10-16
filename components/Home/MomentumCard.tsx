import React from 'react';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import type { Momentum } from '@/lib/momentum';
import { HomeStatCard } from './HomeStatCard';

/**
 * Trend: the share of your habits you kept over the last 30 days, and whether
 * that is up or down on the 30 before. The arrow is the point — it says if you
 * are getting better, whatever your level.
 */
export const MomentumCard: React.FC<{ momentum: Momentum; onPress: () => void }> = ({ momentum, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { rate, delta, comparable } = momentum;
    const up = comparable && delta > 0;
    const down = comparable && delta < 0;
    const tint = up ? colors.success : down ? colors.warning : primary;
    const note = !comparable ? 'last 30 days' : delta === 0 ? 'same as last month' : `${up ? '↑' : '↓'} ${Math.abs(delta)} vs last month`;
    return (
        <HomeStatCard
            icon={up ? 'trending-up' : down ? 'trending-down' : 'pulse'}
            tint={tint}
            value={`${rate}%`}
            label="Trend"
            note={note}
            noteTint={comparable && delta !== 0 ? tint : undefined}
            onPress={onPress}
            accessibilityLabel={`Trend: you kept ${rate} percent of your habits in the last 30 days${comparable ? `, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} on the month before` : ''}`}
        />
    );
};
