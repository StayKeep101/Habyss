import { useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { deleteTask, type Task } from '@/lib/tasks';
import { emit } from '@/lib/appEvents';

/**
 * Deleting a task always asks first, wherever it starts: a swipe in the list,
 * a drop on the bin in the timeline, a goal's page. The same sheet as a
 * habit's (hooks/useRemoveHabit.ts): from the bottom, the destructive choice
 * in red, Cancel apart. A task happens once, so there is one way to delete it.
 */
export function useRemoveTask() {
    return useCallback((task: Pick<Task, 'id' | 'title' | 'subtasks'>, onDone?: () => void) => {
        const run = () => deleteTask(task.id)
            .then(() => { emit('tasks_changed'); onDone?.(); })
            .catch(() => Alert.alert('Could not delete task', 'Your task is still saved. Please try again.'));
        const steps = task.subtasks?.length ?? 0;
        const message = steps ? `Its ${steps} ${steps === 1 ? 'subtask goes' : 'subtasks go'} with it. This can’t be undone.` : 'This can’t be undone.';
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions({
                title: task.title, message,
                options: ['Delete Task', 'Cancel'],
                destructiveButtonIndex: 0,
                cancelButtonIndex: 1,
            }, index => { if (index === 0) void run(); });
            return;
        }
        Alert.alert(task.title, message, [
            { text: 'Delete Task', style: 'destructive', onPress: () => void run() },
            { text: 'Cancel', style: 'cancel' },
        ]);
    }, []);
}
