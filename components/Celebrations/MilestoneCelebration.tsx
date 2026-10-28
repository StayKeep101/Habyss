import React, { useEffect, useState } from 'react';
import { on } from '@/lib/appEvents';
import { useAccentGradient } from '@/context/AccentContext';
import { GoalCompleteSequence, type GoalReached } from '@/components/Celebrations/GoalCompleteSequence';

/**
 * Where a reached goal is celebrated, at the root of the app: a habit can be
 * ticked from the roadmap, a goal's page, a notification or a widget, and the
 * moment a goal is reached is worth marking wherever you are. The ceremony
 * itself is GoalCompleteSequence (docs/motion-system.md §4.1).
 */
export const MilestoneCelebration: React.FC = () => {
    const { primary } = useAccentGradient();
    const [shown, setShown] = useState<GoalReached | null>(null);
    useEffect(() => {
        const sub = on('goal_complete', payload => setShown({
            name: payload?.name ?? 'Your goal',
            color: payload?.color || primary,
            icon: payload?.icon,
            count: payload?.count,
        }));
        return () => sub.remove();
    }, [primary]);
    if (!shown) return null;
    return <GoalCompleteSequence key={shown.name} goal={shown} onDone={() => setShown(null)} />;
};
