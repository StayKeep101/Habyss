import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MOTION, useProgress, CountUp, ListItem } from '@/components/ui/Motion';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { DailyFocus } from '@/lib/dailyFocus';
import type { Task } from '@/lib/tasks';


/**
 * The day's promise, on the home screen.
 *
 * Three things, or five, and the day is kept. The number is deliberately small
 * enough to finish, so the card can be read in one glance and believed: a row
 * for each, ticked where it is done, and a line of pips that fills as the day
 * is won. Nothing here scrolls and nothing is hidden behind a tap — a promise
 * you have to go looking for is not one you keep.
 *
 * Built like the cards it sits with: the same glass surface, the same
 * letter-spaced heading, the same scaled type.
 */
export const DailyFocusCard: React.FC<{
    focus: DailyFocus & { streak?: number };
    onToggle: (task: Task) => void;
    onOpen: () => void;
    onAdd: () => void;
}> = ({ focus, onToggle, onOpen, onAdd }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary } = useAccentGradient();
    const { selectionFeedback, lightFeedback } = useHaptics();

    const tint = focus.complete ? colors.success : primary;
    // Before anything is ticked the rows speak for themselves, so the caption
    // stays quiet rather than labelling what is already in front of you.
    const caption = focus.complete
        ? (focus.extra > 0 ? `All ${focus.target} done, and ${focus.extra} more` : `All ${focus.target} done`)
        : focus.done > 0
            ? `${focus.target - focus.done} to go`
            : null;

    return (
        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.container]}>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Today's tasks, ${focus.done} of ${focus.target} done. Open task insights.`}
                activeOpacity={0.8}
                onPress={() => { lightFeedback(); onOpen(); }}
                style={styles.header}
            >
                <View style={styles.titleRow}>
                    <Ionicons name="checkmark-done" size={s(16)} color={tint} />
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Today&apos;s {focus.target}</Text>
                </View>

                {focus.streak ? (
                    <View accessible accessibilityLabel={`${focus.streak} day streak`} style={[styles.badge, { backgroundColor: '#F9731618', marginLeft: 'auto', marginRight: 6 }]}>
                        <Ionicons name="flame" size={s(12)} color="#F97316" />
                        <CountUp style={[styles.badgeText, { color: '#F97316' }]} value={focus.streak} />
                    </View>
                ) : null}
                <View style={[styles.badge, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
                    <CountUp style={[styles.badgeText, { color: colors.textSecondary }]} value={`${focus.done}/${focus.target}`} />
                    <Ionicons name="chevron-forward" size={s(12)} color={colors.textTertiary} />
                </View>
            </TouchableOpacity>

            <View style={styles.pips} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: focus.target, now: focus.progress }}>
                {Array.from({ length: focus.target }, (_, index) => (
                    <Pip key={index} index={index} filled={index < focus.progress} tint={tint} idle={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'} />
                ))}
            </View>

            {focus.rows.length === 0 ? (
                <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => { lightFeedback(); onAdd(); }} style={styles.empty}>
                    <Ionicons name="add-circle-outline" size={s(18)} color={primary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Pick {focus.target} things that would make today count
                    </Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.rows}>
                    {focus.rows.map(task => {
                        const done = task.status === 'done';
                        return (
                            <ListItem key={task.id}><TouchableOpacity
                                key={task.id}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: done }}
                                accessibilityLabel={task.title}
                                activeOpacity={0.7}
                                onPress={() => { selectionFeedback(); onToggle(task); }}
                                style={styles.row}
                            >
                                <View style={[styles.box, {
                                    backgroundColor: done ? colors.success : 'transparent',
                                    borderColor: done ? colors.success : (isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.26)'),
                                }]}>
                                    {done ? <Ionicons name="checkmark" size={s(13)} color="#FFFFFF" /> : null}
                                </View>
                                <Text
                                    numberOfLines={1}
                                    style={[styles.rowText, {
                                        color: done ? colors.textTertiary : colors.textPrimary,
                                        textDecorationLine: done ? 'line-through' : 'none',
                                    }]}
                                >
                                    {task.title}
                                </Text>
                                {task.dueTime && !done ? (
                                    <Text style={[styles.time, { color: colors.textTertiary }]}>{task.dueTime}</Text>
                                ) : null}
                            </TouchableOpacity></ListItem>
                        );
                    })}
                </View>
            )}

            {caption ? <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{caption}</Text> : null}
        </VoidCard>
    );
};

/** One of the day's slots, filling as it is won. */
const Pip = ({ index, filled, tint, idle }: { index: number; filled: boolean; tint: string; idle: string }) => {
    const on = useProgress(filled ? 1 : 0, index * MOTION.stagger * 2);
    const style = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.get(), [0, 1], [idle, tint]) }));
    return <Animated.View style={[styles.pip, style]} />;
};

const styles = StyleSheet.create({
    container: { padding: s(20) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(14) },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
    title: { fontSize: ms(17), fontFamily: FontFamily.bold },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(10), paddingVertical: vs(6), borderRadius: s(12), gap: s(4) },
    badgeText: { fontSize: ms(12), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    pips: { flexDirection: 'row', gap: s(6), marginBottom: vs(12) },
    pip: { flex: 1, height: vs(6), borderRadius: s(3) },
    rows: { gap: vs(2) },
    row: { flexDirection: 'row', alignItems: 'center', gap: s(12), paddingVertical: vs(8) },
    box: { width: s(22), height: s(22), borderRadius: s(7), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1, fontSize: ms(14), fontFamily: FontFamily.regular },
    time: { fontSize: ms(11), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    empty: { flexDirection: 'row', alignItems: 'center', gap: s(8), paddingVertical: vs(6) },
    emptyText: { flex: 1, fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
    subtitle: { fontSize: ms(12), fontFamily: FontFamily.regular, marginTop: vs(10) },
});
