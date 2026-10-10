import React from 'react';
import { Pressable } from 'react-native';
import { Badge, Button, Card, CardHeader, HabitRow, ProgressBar, Stack, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import type { DailyFocus } from '@/lib/dailyFocus';
import type { Task } from '@/lib/tasks';

/**
 * The day's promise, on the home screen: three things, or five, a slot for
 * each that fills as they are done, and the rows to tick them off.
 */
export const DailyFocusCard: React.FC<{
    focus: DailyFocus & { streak?: number };
    onToggle: (task: Task) => void;
    onOpen: () => void;
    onAdd: () => void;
}> = ({ focus, onToggle, onOpen, onAdd }) => {
    const { selectionFeedback, lightFeedback } = useHaptics();
    // Before anything is ticked the rows speak for themselves.
    const caption = focus.complete
        ? (focus.extra > 0 ? `All ${focus.target} done, and ${focus.extra} more` : `All ${focus.target} done`)
        : focus.done > 0 ? `${focus.target - focus.done} to go` : null;

    return (
        <Card padding="xl" gap="lg">
            <Pressable accessibilityRole="button" onPress={() => { lightFeedback(); onOpen(); }}
                accessibilityLabel={`Today's tasks, ${focus.done} of ${focus.target} done. Open task insights.`}>
                <CardHeader title={`Today's ${focus.target}`} icon="checkmark-done" trailing={`${focus.done}/${focus.target}`} chevron>
                    {focus.streak ? <Badge label={String(focus.streak)} tone="warning" icon="flame" /> : null}
                </CardHeader>
            </Pressable>

            <ProgressBar progress={focus.progress / focus.target} segments={focus.target} tone={focus.complete ? 'success' : 'accent'} />

            {focus.rows.length === 0 ? (
                <Button variant="ghost" icon="add-circle-outline" label={`Pick ${focus.target} things that would make today count`} onPress={onAdd} />
            ) : (
                <Stack>
                    {focus.rows.map(task => (
                        <HabitRow
                            key={task.id}
                            variant="plain"
                            kind="task"
                            title={task.title}
                            done={task.status === 'done'}
                            trailing={task.status !== 'done' ? task.dueTime : undefined}
                            onToggle={() => { selectionFeedback(); onToggle(task); }}
                        />
                    ))}
                </Stack>
            )}

            {caption ? <Text variant="label" tone={focus.complete ? 'success' : 'muted'}>{caption}</Text> : null}
        </Card>
    );
};
