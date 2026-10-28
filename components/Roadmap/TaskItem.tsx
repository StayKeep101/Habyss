import { FontFamily } from '@/theme/designSystem';
import { formatDuration } from '@/lib/habitMeasurement';
import React from 'react';
import { SubtaskList, SubtaskToggle } from '@/components/Tasks/SubtaskDropdown';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { AnimatedFill } from '@/components/ui/Motion';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Gesture, GestureDetector, TouchableOpacity } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { HOLD_MS, STILL } from '@/components/ui/DragDrop';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { BadgeRow, PriorityFlag, ReminderBadge } from '@/components/Common/CardBadges';
import { SharedFaces } from '@/components/Common/SharedFaces';
import type { SharedState } from '@/lib/shared';
import { CheckPop } from '@/components/ui/CheckPop';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidCard } from '@/components/ui/VoidCard';
import { FocusPill } from '@/components/ui/FocusPill';
import { Radius } from '@/theme/designSystem';
import type { RoadMapCardSize } from '@/context/AppSettingsContext';
import { isLate, setTaskAmount, taskAmountLabel, taskShare, type Task } from '@/lib/tasks';
import { emit } from '@/lib/appEvents';
import { dueLabel } from '@/lib/dayFlow';

/** Tasks are amber throughout, so they read as a different kind of thing. */
export const TASK_COLOR = '#F59E0B';

interface Props {
    task: Task;
    today: string;
    onToggle: (task: Task) => void;
    onPress: (task: Task) => void;
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
    /** Shown when the task is listed outside its goal. */
    goalName?: string;
    /**
     * Who else is on it, when anybody is.
     *
     * Passed in rather than fetched here, for the same reason as on a habit
     * row: a list of thirty would otherwise open thirty requests.
     */
    shared?: SharedState | null;
    size?: RoadMapCardSize;
    /**
     * What the row's gestures do.
     *
     * `all` is the roadmap tab: tick it, edit it, delete it. `reschedule` is
     * the goal's plan, where the only question being asked is *when* — so the
     * swipes move the day and nothing else is offered.
     */
    actions?: 'all' | 'reschedule';
    /** Days to move by, when `actions` is `reschedule`. */
    onMove?: (task: Task, days: number) => void;
    /** Hold and drag onto a goal to move it there, exactly like a habit. */
    onDragStart?: (task: Task, x: number, y: number) => void;
    onDragMove?: (task: Task, x: number, y: number) => void;
    onDragEnd?: (task: Task, x: number, y: number) => void;
    isDragging?: boolean;
    /** It is what you should be on right now: Focus sits on the card. */
    canFocusNow?: boolean;
}

const shortDate = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const shortLength = (minutes: number) =>
    formatDuration(minutes * 60, true);

/**
 * A task in the roadmap, alongside habits.
 *
 * The same card, spacing and gestures as a habit row, so the tab reads as one
 * list rather than two designs stitched together. What differs is what a task
 * actually is: a square box instead of a circle, amber instead of the accent,
 * and a due date where a habit shows its time of day. A habit is a rhythm; a
 * task is finished once and then gone.
 */
const TaskItemComponent: React.FC<Props> = ({
    task, today, onToggle, onPress, onEdit, onDelete, goalName, shared = null, size = 'standard',
    actions = 'all', onMove, onDragStart, onDragMove, onDragEnd, isDragging = false, canFocusNow = false,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { mediumFeedback, selectionFeedback } = useHaptics();

    // The same measurements as a habit row, so the two line up in a list.
    const isSmall = size === 'small';
    const isBig = size === 'big';
    const paddingV = isSmall ? 4 : (isBig ? 12 : 10);
    const iconSize = isSmall ? 12 : (isBig ? 16 : 14);
    const iconBoxSize = isSmall ? 20 : (isBig ? 32 : 26);
    const fontSize = isSmall ? 11 : (isBig ? 14 : 13);
    const boxSize = isSmall ? 14 : (isBig ? 20 : 18);

    const doneByMe = task.status === 'done';
    // A shared task is not finished until everybody on it is, the same rule the
    // habit rows follow. Your own tick still fills your own box.
    const done = shared ? shared.complete : doneByMe;
    // Late only past its deadline; a day passed before the deadline is today's work.
    const overdue = !done && isLate(task, today);
    const dueToday = !done && !overdue && !!task.dueDate && task.dueDate <= today;
    // The deadline, worded and coloured as the timeline shows it (one rule: dueLabel).
    const deadline = task.deadline && task.deadline !== task.dueDate ? dueLabel(task.deadline, today) : null;
    const deadlineUrgent = deadline === 'Due today' || deadline === 'Overdue';

    // Right-hand column, where a habit shows its time.
    const when = done
        ? 'Done'
        : overdue ? 'Overdue'
            : dueToday ? (task.dueTime ?? 'Today')
                : task.dueDate ? shortDate(task.dueDate) : '—';
    const whenColor = overdue ? colors.error : dueToday ? TASK_COLOR : colors.textTertiary;

    const label = [
        overdue ? 'Overdue' : task.dueDate ? `${task.dueDate <= today ? 'Today' : shortDate(task.dueDate)}` : 'No date',
        deadline,
        task.dueTime,
        task.estimatedMinutes ? shortLength(task.estimatedMinutes) : null,
        task.priority === 1 ? 'High priority' : null,
        goalName,
    ].filter(Boolean).join(', ');

    const amountLabel = taskAmountLabel(task);
    const share = taskShare(task);

    /**
     * A tap ticks it. A task measured in time is done in one tap like any
     * other; a counted one asks how many to add ("how many calls?"), with
     * Finish right there.
     */
    const toggle = () => {
        if (!amountLabel || doneByMe || task.measure === 'time' || Platform.OS !== 'ios') { onToggle(task); return; }
        Alert.prompt(
            task.title,
            `${amountLabel} so far. How many to add?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Finish', onPress: () => onToggle(task) },
                {
                    text: 'Add', isPreferred: true, onPress: (value?: string) => {
                        const amount = Number(String(value ?? '').replace(',', '.'));
                        if (!Number.isFinite(amount) || amount <= 0) return;
                        selectionFeedback();
                        setTaskAmount(task, (task.amount ?? 0) + amount)
                            .then(() => emit('tasks_changed'))
                            .catch(() => Alert.alert('Could not save', 'Please try again.'));
                    },
                },
            ],
            'plain-text', '', 'decimal-pad',
        );
    };

    // Its subtasks, folded away until the chevron opens them.
    const [stepsOpen, setStepsOpen] = React.useState(false);

    // A still hold lifts it; moving first is a scroll. Only a drag that really
    // began ends in a drop (onEnd): a tap, a scroll or the tick never does.
    const drag = Gesture.Pan()
        .enabled(!!onDragStart)
        .activateAfterLongPress(HOLD_MS)
        .failOffsetX([-STILL, STILL]).failOffsetY([-STILL, STILL])
        .onStart(event => { if (onDragStart) runOnJS(onDragStart)(task, event.absoluteX, event.absoluteY); })
        .onUpdate(event => { if (onDragMove) runOnJS(onDragMove)(task, event.absoluteX, event.absoluteY); })
        .onEnd(event => { if (onDragEnd) runOnJS(onDragEnd)(task, event.absoluteX, event.absoluteY); });

    return (
        <GestureDetector gesture={drag}>
        <View style={isDragging ? styles.dragging : undefined}>
        <SwipeRow
            left={actions === 'reschedule'
                ? {
                    icon: 'chevron-back', label: 'Sooner', color: TASK_COLOR,
                    onPress: () => { selectionFeedback(); onMove?.(task, -1); },
                }
                // Focus where the check was; a done task offers its undo instead.
                : done ? {
                    icon: 'arrow-undo', label: 'Undo', color: colors.textTertiary,
                    onPress: () => onToggle(task),
                } : {
                    icon: 'timer', label: 'Focus', color: TASK_COLOR,
                    onPress: () => { selectionFeedback(); require('expo-router').router.push({ pathname: '/(root)/focus', params: { kind: 'task', id: task.id, title: task.title } }); },
                }}
            right={actions === 'reschedule'
                ? [
                    { icon: 'chevron-forward', label: 'Later', color: TASK_COLOR, onPress: () => { selectionFeedback(); onMove?.(task, 1); } },
                    { icon: 'play-forward', label: 'Next week', color: TASK_COLOR, onPress: () => { selectionFeedback(); onMove?.(task, 7); } },
                ]
                : [
                    { icon: 'pencil', label: 'Edit', color: TASK_COLOR, onPress: () => { selectionFeedback(); onEdit(task); } },
                    { icon: 'trash', label: 'Delete', color: '#EF4444', destructive: true, onPress: () => { mediumFeedback(); onDelete(task); } },
                ]}
        >
            <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Task: ${task.title}. ${label}`}
                onPress={() => onPress(task)}
            >
                {/* Squarer corners than a habit's round ends: a task is a thing to finish, not a rhythm. */}
                <VoidCard radius={Radius.small} intensity={40} style={[styles.cardColumn, { paddingVertical: paddingV }, done && { opacity: 0.7 }]}>
                    <View style={styles.card}>
                    {/* Square, where a habit is round: the difference at a glance.
                        On the plan it is a mark rather than a control: ticking
                        things off belongs to the day, not to the map of it. */}
                    <TouchableOpacity
                        disabled={actions === 'reschedule'}
                        accessible={actions !== 'reschedule'}
                        activeOpacity={0.6}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: doneByMe }}
                        accessibilityLabel={done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
                        onPress={toggle}
                        hitSlop={Math.max(10, (44 - boxSize) / 2)}
                    >
                        <CheckPop active={doneByMe} color={TASK_COLOR} size={boxSize}>
                            <View style={[styles.box, {
                                width: boxSize, height: boxSize, borderRadius: isSmall ? 4 : 5,
                                borderColor: doneByMe ? TASK_COLOR : overdue ? colors.error : 'rgba(128,128,128,0.4)',
                                backgroundColor: doneByMe ? TASK_COLOR + '30' : 'transparent',
                            }]}>
                                {doneByMe ? <Ionicons name="checkmark" size={boxSize * 0.7} color={TASK_COLOR} /> : null}
                            </View>
                        </CheckPop>
                    </TouchableOpacity>

                    <View style={[styles.iconBox, {
                        width: iconBoxSize, height: iconBoxSize,
                        backgroundColor: TASK_COLOR + (done ? '12' : '1f'),
                    }]}>
                        <Ionicons name={done ? 'checkmark-done' : 'flash'} size={iconSize} color={TASK_COLOR} />
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text
                            numberOfLines={1}
                            style={[styles.title, {
                                fontSize,
                                color: done ? colors.textTertiary : colors.textPrimary,
                                textDecorationLine: done ? 'line-through' : 'none',
                            }]}
                        >
                            {task.title}
                        </Text>
                        <View style={styles.metaRow}>
                            <BadgeRow>
                                <PriorityFlag priority={task.priority} size={isSmall ? 10 : undefined} />
                                {/* A dated task is one the reminder can reach. */}
                                <ReminderBadge on={!done && !!task.dueDate} size={isSmall ? 10 : undefined} />
                            </BadgeRow>
                            {amountLabel ? (
                                <Text style={[styles.meta, { color: done ? colors.textTertiary : TASK_COLOR, fontVariant: ['tabular-nums'] }]}>{amountLabel}</Text>
                            ) : null}
                            {deadline && !done ? (
                                <Text numberOfLines={1} style={[styles.meta, styles.deadline, { color: deadlineUrgent ? colors.warning : colors.textTertiary }]}>{deadline}</Text>
                            ) : null}
                            {/* Its subtasks: how many are done, and a chevron that opens them. */}
                            {task.subtasks?.length ? (
                                <SubtaskToggle steps={task.subtasks} open={stepsOpen} onToggle={() => setStepsOpen(value => !value)} color={TASK_COLOR} />
                            ) : null}
                            {shared ? (
                                <SharedFaces people={shared.people} tint={TASK_COLOR} size={isSmall ? 20 : 24} />
                            ) : goalName && !isSmall ? (
                                <Text numberOfLines={1} style={[styles.meta, { color: colors.textTertiary }]}>{goalName}</Text>
                            ) : null}
                        </View>
                        {amountLabel && !done && !isSmall ? (
                            <View style={[styles.track, { backgroundColor: TASK_COLOR + '22' }]}>
                                <AnimatedFill progress={share} style={[styles.fill, { backgroundColor: TASK_COLOR }]} />
                            </View>
                        ) : null}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                        {canFocusNow && !done && actions === 'all' ? (
                            <FocusPill color={TASK_COLOR} label={task.title} compact={isSmall}
                                onPress={() => { selectionFeedback(); require('expo-router').router.push({ pathname: '/(root)/focus', params: { kind: 'task', id: task.id, title: task.title } }); }} />
                        ) : null}
                        {canFocusNow && !done ? null : task.estimatedMinutes && !isSmall ? (
                            <Text style={[styles.estimate, { color: colors.textTertiary }]}>{shortLength(task.estimatedMinutes)}</Text>
                        ) : null}
                        {canFocusNow && !done && actions === 'all' ? null : <Text style={[styles.when, { color: whenColor, fontSize: isSmall ? 9 : 11 }]}>{when}</Text>}
                    </View>
                    </View>
                    {/* Its subtasks, inside its own card, lined up under the title. */}
                    {stepsOpen && task.subtasks?.length ? <SubtaskList taskId={task.id} steps={task.subtasks} color={TASK_COLOR} indent={boxSize + iconBoxSize + 20} /> : null}
                </VoidCard>
            </TouchableOpacity>
        </SwipeRow>
        </View>
        </GestureDetector>
    );
};

export const TaskItem = React.memo(TaskItemComponent);

const styles = StyleSheet.create({
    dragging: { opacity: 0.25 },
    cardColumn: { paddingHorizontal: 12, borderRadius: 8 },
    card: { flexDirection: 'row', alignItems: 'center' },
    box: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    iconBox: { borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    title: { fontFamily: FontFamily.medium },
    meta: { fontSize: 11, fontFamily: FontFamily.regular, flexShrink: 1 },
    deadline: { fontFamily: FontFamily.semibold },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    track: { height: 3, borderRadius: 2, marginTop: 5, overflow: 'hidden' },
    fill: { height: 3, borderRadius: 2 },
    estimate: { fontSize: 11, fontFamily: FontFamily.regular, marginBottom: 1 },
    when: { fontFamily: FontFamily.regular, fontVariant: ['tabular-nums'] },
});
