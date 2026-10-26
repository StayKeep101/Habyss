import React from 'react';
import { useTokens } from '@/hooks/useTokens';
import type { Missed } from '@/lib/missed';
import { HomeStatCard } from './HomeStatCard';

/**
 * Missed: how many habits and tasks are missed right now, and nothing under
 * it. Missing a habit twice in a row turns the card red; the list it opens
 * says which.
 */
export const MissedCard: React.FC<{ missed: Missed; onPress: () => void }> = ({ missed, onPress }) => {
    const t = useTokens();
    const total = missed.items.length;
    const tint = missed.twice ? t.color.danger : total ? t.color.warning : t.color.success;
    return (
        <HomeStatCard icon={total ? 'alert-circle' : 'checkmark-done'} tint={tint} value={total} label="Missed"
            onPress={onPress}
            accessibilityLabel={`Missed: ${total} habits and tasks, ${missed.twice} habits missed twice or more in a row`} />
    );
};
