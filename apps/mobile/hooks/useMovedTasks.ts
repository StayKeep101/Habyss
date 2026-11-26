import { useEffect, useSyncExternalStore } from 'react';
import { currentMoves, loadMoves, subscribeMoves } from '@/lib/movedTasks';
import type { TaskMove } from '@/lib/missed';

/** Tasks the timeline carried to the next day (lib/movedTasks.ts). */
export function useMovedTasks(): TaskMove[] {
    useEffect(() => { void loadMoves(); }, []);
    return useSyncExternalStore(subscribeMoves, currentMoves, currentMoves);
}
