import { useData } from '@/hooks/useData';
import type { Task } from '@/lib/tasks';

/**
 * Every task, done ones included, kept current as tasks change anywhere in the
 * app (created, ticked, restored from a backup). The shared copy: every screen
 * gets the same list.
 */
export function useTasks(): Task[] {
    return useData().tasks;
}
