import { useEffect, useState } from 'react';
import { getTasks, type Task } from '@/lib/tasks';
import { on } from '@/lib/appEvents';

/**
 * Every task, done ones included, kept current as tasks change anywhere in the
 * app (created, ticked, restored from a backup).
 */
export function useTasks(): Task[] {
    const [tasks, setTasks] = useState<Task[]>([]);
    useEffect(() => {
        let alive = true;
        const load = () => {
            getTasks({ includeDone: true })
                .then(list => { if (alive) setTasks(list); })
                .catch(() => undefined);
        };
        load();
        const subs = [
            on('tasks_changed', load),
            on('cloud_restored', load),
        ];
        return () => { alive = false; subs.forEach(sub => sub.remove()); };
    }, []);
    return tasks;
}
