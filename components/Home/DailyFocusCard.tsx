import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeOut, ReduceMotion, ZoomIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { ListItem } from '@/components/ui/Motion';
import { CheckPop } from '@/components/ui/CheckPop';
import { StruckTitle } from '@/components/ui/StruckTitle';
import { DURATION, EASE } from '@/theme/motion';
import { ValuePill } from '@/components/Goal/GoalRows';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { DailyFocus } from '@/lib/dailyFocus';
import type { Task } from '@/lib/tasks';


/**
 * The day's promise, on the home screen, with as little around it as possible:
 * a title, how many are done in a pill, and the tasks to tick. Tap the title
 * for the task insights.
 */
export const DailyFocusCard: React.FC<{
    focus: DailyFocus & { streak?: number };
    /** The app-wide perfect-day multiplier (×1 to ×10). */
    multiplier?: number;
    onToggle: (task: Task) => void;
    onOpen: () => void;
    onAdd: () => void;
}> = ({ focus, onToggle, onOpen, onAdd, multiplier = 1 }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback } = useHaptics();
    // The run of days this target was hit, and the app-wide perfect-day multiplier.
    const streak = focus.streak ?? 0;

    return (
        <VoidCard style={styles.container}>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Today's tasks, ${focus.done} of ${focus.target} done. Open task insights.`}
                activeOpacity={0.7}
                onPress={() => { lightFeedback(); onOpen(); }}
                style={styles.header}
            >
                <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Today&apos;s {focus.target}</Text>
                    {/* The run of days, beside the title: the flame and the number. */}
                    <View style={styles.streak} accessible accessibilityLabel={`${streak} days in a row${multiplier > 1 ? `, times ${multiplier}` : ''}`}>
                        <Ionicons name="flame" size={s(14)} color={streak > 0 ? colors.warning : colors.textTertiary} />
                        <Text style={[styles.streakText, { color: streak > 0 ? colors.textPrimary : colors.textTertiary }]}>{streak}</Text>
                        {multiplier > 1 ? <Text style={[styles.streakText, { color: colors.textTertiary }]}>×{multiplier}</Text> : null}
                    </View>
                </View>
                <ValuePill value={`${focus.done}/${focus.target}`} tone={focus.complete ? colors.success : undefined} />
            </TouchableOpacity>

            {focus.rows.length === 0 ? (
                <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => { lightFeedback(); onAdd(); }} style={styles.row}>
                    <Ionicons name="add" size={s(18)} color={colors.textTertiary} />
                    <Text style={[styles.rowText, { color: colors.textTertiary }]}>Add a task</Text>
                </TouchableOpacity>
            ) : (
                focus.rows.map(task => (
                    <ListItem key={task.id}><FocusTaskRow task={task} onToggle={onToggle} /></ListItem>
                ))
            )}
        </VoidCard>
    );
};

/** One of the day's tasks: tick it and the box fills, swells and rings once, the mark lands, the name dims and is struck through. */
function FocusTaskRow({ task, onToggle }: { task: Task; onToggle: (task: Task) => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const done = task.status === 'done';
    const box = useAnimatedStyle(() => ({
        backgroundColor: withTiming(done ? colors.success : 'transparent', { duration: DURATION.quick, easing: EASE.enter, reduceMotion: ReduceMotion.System }),
        borderColor: withTiming(done ? colors.success : colors.textTertiary, { duration: DURATION.quick, easing: EASE.enter, reduceMotion: ReduceMotion.System }),
    }));
    return (
        <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={task.title}
            activeOpacity={0.7}
            onPress={() => { selectionFeedback(); onToggle(task); }}
            style={styles.row}
        >
            <CheckPop active={done} color={colors.success} size={s(22)}>
                <Animated.View style={[styles.box, box]}>
                    {done ? (
                        <Animated.View entering={ZoomIn.duration(DURATION.quick).easing(EASE.enter).reduceMotion(ReduceMotion.System)}
                            exiting={FadeOut.duration(DURATION.tap).reduceMotion(ReduceMotion.System)}>
                            <Ionicons name="checkmark" size={s(13)} color={colors.background} />
                        </Animated.View>
                    ) : null}
                </Animated.View>
            </CheckPop>
            <View style={styles.rowTitleBox}>
                <StruckTitle title={task.title} done={done} style={styles.rowTitle} />
            </View>
            {task.dueTime && !done ? (
                <Text style={[styles.time, { color: colors.textTertiary }]}>{task.dueTime}</Text>
            ) : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: s(18), paddingTop: s(16), paddingBottom: s(8) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(6) },
    title: { fontSize: ms(17), fontFamily: FontFamily.bold },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
    streak: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
    streakText: { fontSize: ms(14), fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    row: { flexDirection: 'row', alignItems: 'center', gap: s(12), paddingVertical: vs(10) },
    box: { width: s(22), height: s(22), borderRadius: s(7), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1, fontSize: ms(15), fontFamily: FontFamily.medium },
    rowTitle: { fontSize: ms(15), fontFamily: FontFamily.medium },
    /** Hugs the name, so the strike line ends where the words do. */
    rowTitleBox: { flex: 1, alignItems: 'flex-start' },
    time: { fontSize: ms(12), fontFamily: FontFamily.regular, fontVariant: ['tabular-nums'] },
});
