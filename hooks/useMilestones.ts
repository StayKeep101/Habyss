import { useCallback, useEffect, useState } from 'react';
import { on } from '@/lib/appEvents';
import { getMilestones, type Milestone } from '@/lib/goalMilestones';

/** A goal's milestones (lib/goalMilestones.ts), kept fresh as they change or sync in. */
export function useMilestones(goalId: string | undefined): Milestone[] {
    const [list, setList] = useState<Milestone[]>([]);
    const load = useCallback(() => {
        if (!goalId) { setList([]); return; }
        void getMilestones(goalId).then(setList).catch(() => undefined);
    }, [goalId]);
    useEffect(() => {
        load();
        const sub = on('milestones_changed', ({ goalId: changed }) => { if (!changed || changed === goalId) load(); });
        return () => sub.remove();
    }, [goalId, load]);
    return list;
}
