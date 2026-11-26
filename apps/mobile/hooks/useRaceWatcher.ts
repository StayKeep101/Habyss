import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useTasks } from '@/hooks/useTasks';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { finishRace, raceDone, raceFeed, type Race } from '@/lib/races';

/**
 * Your race against the clock (lib/races.ts), watched wherever you are in the
 * app: the moment its last task is ticked, in time, it is won (the server
 * pays out). Running out of time is settled by the server itself. Mounted
 * once, under the tabs.
 */
export function useRaceWatcher() {
    const tasks = useTasks();
    const { successFeedback } = useHaptics();
    const mine = useRef<Race | null>(null);
    const finishing = useRef(false);

    useEffect(() => {
        const read = () => { void raceFeed().then(races => { mine.current = races.find(race => race.mine && race.status === 'open') ?? null; }).catch(() => undefined); };
        read();
        const changed = on('market_changed', read);
        const state = AppState.addEventListener('change', next => { if (next === 'active') read(); });
        return () => { changed.remove(); state.remove(); };
    }, []);

    useEffect(() => {
        const race = mine.current;
        if (!race || finishing.current || !raceDone(race, tasks.map(task => ({ id: task.id, status: task.status, completedAt: task.completedAt })))) return;
        finishing.current = true;
        void finishRace(race.id, true).then(result => {
            if (result === 'won') successFeedback();
            mine.current = null;
        }).finally(() => { finishing.current = false; });
    }, [tasks, successFeedback]);
}
