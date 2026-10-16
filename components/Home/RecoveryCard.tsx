import React from 'react';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import type { Recovery } from '@/lib/recovery';
import { HomeStatCard } from './HomeStatCard';

/**
 * Bounce back: never miss twice. When a habit you missed last time is due
 * again today, this says how many can still be saved. Otherwise, how often you
 * get straight back on it after a miss.
 */
export const RecoveryCard: React.FC<{ recovery: Recovery; onPress: () => void }> = ({ recovery, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const toSave = recovery.atRisk.length;
    if (toSave > 0) {
        return (
            <HomeStatCard icon="shield-half" tint={colors.warning} value={toSave} label="To save today" note="missed last time"
                noteTint={colors.warning} onPress={onPress}
                accessibilityLabel={`${toSave} habit${toSave === 1 ? '' : 's'} you missed last time ${toSave === 1 ? 'is' : 'are'} due again today`} />
        );
    }
    const rate = recovery.rate;
    return (
        <HomeStatCard icon="shield-checkmark" tint={rate === null || rate >= 70 ? colors.success : primary}
            value={rate === null ? '—' : `${rate}%`} label="Bounce back" note={rate === null ? 'no misses yet' : 'back on it after a miss'}
            onPress={onPress}
            accessibilityLabel={rate === null ? 'Bounce back: no misses yet' : `Bounce back: after a miss you do the habit the next time ${rate} percent of the time`} />
    );
};
