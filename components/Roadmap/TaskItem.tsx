import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RectButton, Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { Task } from '@/lib/tasks';

/** Tasks are amber throughout, so they read as a different kind of thing. */
export const TASK_COLOR = '#F59E0B';

const PRIORITY_LABEL: Record<number, string> = { 1: 'High', 2: '', 3: 'Low' };

interface Props {
    task: Task;
    today: string;
    onToggle: (task: Task) => void;
    onPress: (task: Task) => void;
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
    /** Shown when the task is listed outside its goal. */
    goalName?: string;
}

const ACTION_WIDTH = 64;

/**
 * A task in the roadmap, alongside habits and goals.
 *
 * Deliberately the same shape and gestures as a habit row so the tab reads as
 * one list, but visibly a different kind of thing: a square box rather than a
 * circle, an amber edge, and the due date and length that only a task has. A
 * habit is a rhythm; a task is finished once and then gone.
 */
const TaskItemComponent: React.FC<Props> = ({ task, today, onToggle, onPress, onEdit, onDelete, goalName }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();

    const swipeableRef = React.useRef<Swipeable>(null);
    const close = () => swipeableRef.current?.close();

    const done = task.status === 'done';
    const overdue = !done && !!task.dueDate && task.dueDate < today;

    const meta: string[] = [];
    if (overdue) meta.push('Overdue');
    else if (task.dueDate && task.dueDate > today) {
        meta.push(new Date(`${task.dueDate}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    }
    if (task.dueTime) meta.push(task.dueTime);
    if (task.estimatedMinutes) {
        meta.push(task.estimatedMinutes < 60 ? `${task.estimatedMinutes} min` : `${task.estimatedMinutes / 60} hr`);
    }
    if (PRIORITY_LABEL[task.priority]) meta.push(PRIORITY_LABEL[task.priority]);
    if (goalName) meta.push(goalName);

    const renderLeftActions = () => (
        <RectButton
            style={[styles.leftAction, { backgroundColor: done ? colors.surfaceSecondary : TASK_COLOR }]}
            onPress={() => { onToggle(task); close(); }}
        >
            <Ionicons name={done ? 'arrow-undo-outline' : 'checkmark'} size={24} color="white" />
        </RectButton>
    );

    const renderRightActions = () => (
        <View style={{ flexDirection: 'row' }}>
            <RectButton
                style={[styles.rightAction, { backgroundColor: '#F59E0B' }]}
                onPress={() => { selectionFeedback(); close(); onEdit(task); }}
            >
                <Ionicons name="pencil" size={20} color="white" />
            </RectButton>
            <RectButton
                style={[styles.rightAction, { backgroundColor: '#EF4444' }]}
                onPress={() => { mediumFeedback(); close(); onDelete(task); }}
            >
                <Ionicons name="trash" size={20} color="white" />
            </RectButton>
        </View>
    );

    return (
        <Swipeable
            ref={swipeableRef}
            renderLeftActions={renderLeftActions}
            renderRightActions={renderRightActions}
            leftThreshold={30}
            rightThreshold={35}
            overshootLeft={false}
            overshootRight={false}
            friction={2}
            onSwipeableWillOpen={() => lightFeedback()}
            containerStyle={styles.swipeContainer}
        >
            <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Task: ${task.title}${meta.length ? `. ${meta.join(', ')}` : ''}`}
                onPress={() => onPress(task)}
                style={[styles.card, {
                    backgroundColor: isLight ? '#fff' : 'rgba(255,255,255,0.05)',
                    borderColor: overdue ? '#EF444455' : colors.border,
                }]}
            >
                {/* The amber edge marks the row as a task at a glance. */}
                <View style={[styles.edge, { backgroundColor: done ? colors.textTertiary : TASK_COLOR }]} />

                <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
                    onPress={() => onToggle(task)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={[styles.box, { borderColor: done ? TASK_COLOR : colors.textTertiary, backgroundColor: done ? TASK_COLOR : 'transparent' }]}
                >
                    {done ? <Ionicons name="checkmark" size={16} color="#000" /> : null}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                    <Text
                        numberOfLines={2}
                        style={[styles.title, {
                            color: done ? colors.textTertiary : colors.textPrimary,
                            textDecorationLine: done ? 'line-through' : 'none',
                        }]}
                    >
                        {task.title}
                    </Text>
                    {meta.length ? (
                        <Text style={[styles.meta, { color: overdue ? '#EF4444' : colors.textTertiary }]} numberOfLines={1}>
                            {meta.join(' · ')}
                        </Text>
                    ) : null}
                </View>

                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
        </Swipeable>
    );
};

const styles = StyleSheet.create({
    swipeContainer: { marginBottom: 8, borderRadius: 16, overflow: 'hidden' },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingRight: 14, paddingLeft: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 15, fontFamily: 'Lexend_500Medium' },
    meta: { fontSize: 12, fontFamily: 'Lexend_400Regular', marginTop: 3 },
    leftAction: { width: ACTION_WIDTH, justifyContent: 'center', alignItems: 'center' },
    rightAction: { width: ACTION_WIDTH, justifyContent: 'center', alignItems: 'center' },
});

export const TaskItem = React.memo(TaskItemComponent);
