import React from 'react';
import { useTokens } from '@/hooks/useTokens';
import type { Missed } from '@/lib/missed';
import { HomeStatCard } from './HomeStatCard';

/**
 * Missed: how many habits and tasks are missed right now. Missing a habit
 * twice in a row is what matters, so the note says how many are there.
 */
export const MissedCard: React.FC<{ missed: Missed; onPress: () => void }> = ({ missed, onPress }) => {
    const t = useTokens();
    const total = missed.items.length;
    const note = missed.twice ? `${missed.twice} twice in a row` : total ? 'none twice in a row' : 'all caught up';
    const tint = missed.twice ? t.color.danger : total ? t.color.warning : t.color.success;
    return (
        <HomeStatCard icon={total ? 'alert-circle' : 'checkmark-done'} tint={tint} value={total} label="Missed"
            note={note} noteTint={total ? tint : undefined} onPress={onPress}
            accessibilityLabel={`Missed: ${total} habits and tasks, ${missed.twice} habits missed twice or more in a row`} />
    );
};
