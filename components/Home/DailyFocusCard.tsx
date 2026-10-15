import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ListItem } from '@/components/ui/Motion';
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
    onToggle: (task: Task) => void;
    onOpen: () => void;
    onAdd: () => void;
}> = ({ focus, onToggle, onOpen, onAdd }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback, lightFeedback } = useHaptics();

    return (
        <VoidCard style={styles.container}>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Today's tasks, ${focus.done} of ${focus.target} done. Open task insights.`}
                activeOpacity={0.7}
                onPress={() => { lightFeedback(); onOpen(); }}
                style={styles.header}
            >
                <Text style={[styles.title, { color: colors.textPrimary }]}>Today&apos;s {focus.target}</Text>
                <ValuePill value={`${focus.done}/${focus.target}`} tone={focus.complete ? colors.success : undefined} />
            </TouchableOpacity>

            {focus.rows.length === 0 ? (
                <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => { lightFeedback(); onAdd(); }} style={styles.row}>
                    <Ionicons name="add" size={s(18)} color={colors.textTertiary} />
                    <Text style={[styles.rowText, { color: colors.textTertiary }]}>Add a task</Text>
                </TouchableOpacity>
            ) : (
                focus.rows.map(task => {
                    const done = task.status === 'done';
                    return (
                        <ListItem key={task.id}><TouchableOpacity
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: done }}
                            accessibilityLabel={task.title}
                            activeOpacity={0.7}
                            onPress={() => { selectionFeedback(); onToggle(task); }}
                            style={styles.row}
                        >
                            <View style={[styles.box, {
                                backgroundColor: done ? colors.success : 'transparent',
                                borderColor: done ? colors.success : colors.textTertiary,
                            }]}>
                                {done ? <Ionicons name="checkmark" size={s(13)} color={colors.background} /> : null}
                            </View>
                            <Text numberOfLines={1} style={[styles.rowText, {
                                color: done ? colors.textTertiary : colors.textPrimary,
                                textDecorationLine: done ? 'line-through' : 'none',
                            }]}>
                                {task.title}
                            </Text>
                            {task.dueTime && !done ? (
                                <Text style={[styles.time, { color: colors.textTertiary }]}>{task.dueTime}</Text>
                            ) : null}
                        </TouchableOpacity></ListItem>
                    );
                })
            )}
        </VoidCard>
    );
};

const styles = StyleSheet.create({
    container: { paddingHorizontal: s(18), paddingTop: s(16), paddingBottom: s(8) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(6) },
    title: { fontSize: ms(17), fontFamily: FontFamily.bold },
    row: { flexDirection: 'row', alignItems: 'center', gap: s(12), paddingVertical: vs(10) },
    box: { width: s(22), height: s(22), borderRadius: s(7), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1, fontSize: ms(15), fontFamily: FontFamily.medium },
    time: { fontSize: ms(12), fontFamily: FontFamily.regular, fontVariant: ['tabular-nums'] },
});
