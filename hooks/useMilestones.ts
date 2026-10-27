import { useCallback, useEffect, useState } from 'react';
import { on } from '@/lib/appEvents';
import { getMilestones, getOpenMilestoneDays, getReachedMilestones, type Milestone } from '@/lib/goalMilestones';

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

/** The days a milestone still ahead is due, on any goal. */
export function useMilestoneDays(): string[] {
    const [days, setDays] = useState<string[]>([]);
    useEffect(() => {
        const load = () => { void getOpenMilestoneDays().then(setDays).catch(() => undefined); };
        load();
        const sub = on('milestones_changed', load);
        return () => sub.remove();
    }, []);
    return days;
}

/** Every milestone reached on any goal, for Marks (+30 each). */
export function useReachedMilestones(): { title: string; doneAt: string }[] {
    const [list, setList] = useState<{ title: string; doneAt: string }[]>([]);
    useEffect(() => {
        const load = () => { void getReachedMilestones().then(setList).catch(() => undefined); };
        load();
        const sub = on('milestones_changed', load);
        return () => sub.remove();
    }, []);
    return list;
}
