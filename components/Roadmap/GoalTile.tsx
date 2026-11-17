import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
// The gesture handler's Pressable, like the rows on the page, so the plan
// button is never lost to the card around it.
import { Pressable } from 'react-native-gesture-handler';
import { SharedFaces } from '@/components/Common/SharedFaces';
import type { SharedState } from '@/lib/shared';
import { AnimatedCircle, CountUp, useProgress } from '@/components/ui/Motion';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useAccentGradient } from '@/context/AccentContext';
import { Control, FontFamily, Radius, Spacing } from '@/theme/designSystem';
import type { Habit } from '@/lib/habitsSQLite';

interface GoalTileProps {
    goal: Habit;
    progress: number;
    /** The tile's side: the Roadmap sizes it so the next one peeks in. */
    width: number;
    onPress: () => void;
    /** Its plan (habits and tasks) is shown under the carousel. */
    isExpanded: boolean;
    onToggleExpand: () => void;
    linkedHabitsCount: number;
    shared?: SharedState | null;
    isDropTarget?: boolean;
}

/** Days from today to a date-only deadline, counted on the calendar (today is 0). */
function daysUntil(targetDate?: string | null): number | null {
    if (!targetDate) return null;
    const end = new Date(`${targetDate.slice(0, 10)}T12:00:00`);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

/**
 * A goal in the Roadmap's carousel, as a near-square card: its icon inside a
 * ring of how far it has come (the only thing in the goal's own colour) and
 * the figure on top; its name and when it is due below, with a button that
 * shows its plan under the carousel. A deadline today or past reads in amber.
 */
export const GoalTile: React.FC<GoalTileProps> = ({
    goal, progress, width, onPress, isExpanded, onToggleExpand, linkedHabitsCount, shared, isDropTarget = false,
}) => {
    const t = useTokens();
    const { primary } = useAccentGradient();
    const color = goal.color || primary;
    const days = daysUntil(goal.targetDate);
    const ring = 44;
    const stroke = 3.5;
    const r = (ring - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const shown = useProgress(Math.max(0, Math.min(1, progress / 100)));
    const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.get()) }));

    const due = days === null ? 'No deadline'
        : days < 0 ? `${-days === 1 ? '1 day' : `${-days} days`} overdue`
        : days === 0 ? 'Due today'
        : days === 1 ? 'Due tomorrow'
        : `${days} days left`;
    const urgent = days !== null && days <= 1;
    const holds = linkedHabitsCount === 1 ? '1 habit' : `${linkedHabitsCount} habits`;
    const photo = !!goal.icon && (goal.icon.includes('/') || goal.icon.startsWith('file:'));
    const outlined = isDropTarget || isExpanded;

    return (
        <MatteSurface radius={Radius.card} style={[styles.card, { width, height: width }, outlined && { borderWidth: 1.5, borderColor: color }]}>
            <Pressable onPress={onPress} style={styles.main}
                accessibilityRole="button" accessibilityLabel={`${goal.name}, ${Math.round(progress)}% done. ${due}. ${holds}. Open`}>
                <View style={styles.top}>
                    <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
                        <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
                            <Circle cx={ring / 2} cy={ring / 2} r={r} stroke={t.color.border} strokeWidth={stroke} fill="none" />
                            <AnimatedCircle cx={ring / 2} cy={ring / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
                                strokeDasharray={`${circumference} ${circumference}`} animatedProps={arc} rotation={-90} origin={`${ring / 2}, ${ring / 2}`}
                                opacity={progress > 0 ? 1 : 0} />
                        </Svg>
                        {photo ? (
                            <Image source={{ uri: goal.icon }} style={{ width: ring - 14, height: ring - 14, borderRadius: (ring - 14) / 2 }} />
                        ) : (
                            <Ionicons filled name={(goal.icon as never) || 'flag'} size={ring * 0.4} color={color} />
                        )}
                    </View>
                    {shared ? <SharedFaces people={shared.people} tint={color} size={20} /> : <CountUp style={[styles.percent, { color: t.color.textPrimary }]} value={`${Math.round(progress)}%`} />}
                </View>

                <Text numberOfLines={2} style={[styles.name, { color: t.color.textPrimary }]}>{goal.name}</Text>
            </Pressable>

            <View style={styles.bottom}>
                <View style={styles.meta}>
                    {urgent ? <Ionicons name="flag" filled size={11} color={t.color.warning} /> : null}
                    <Text numberOfLines={1} style={[styles.metaText, { color: urgent ? t.color.warning : t.color.textMuted }]}>{due}</Text>
                </View>
                <Pressable onPress={onToggleExpand} style={styles.plan} hitSlop={4}
                    accessibilityRole="button" accessibilityState={{ expanded: isExpanded }}
                    accessibilityLabel={`${isExpanded ? 'Hide' : 'Show'} its plan, ${holds}`}>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={isExpanded ? color : t.color.textMuted} />
                </Pressable>
            </View>
        </MatteSurface>
    );
};

const styles = StyleSheet.create({
    card: { paddingTop: Spacing.md, paddingLeft: Spacing.md, overflow: 'hidden' },
    main: { flex: 1, gap: Spacing.sm, paddingRight: Spacing.md },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    name: { fontSize: 16, lineHeight: 20, fontFamily: FontFamily.semibold },
    percent: { fontSize: 15, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    // The due line and the plan button share the bottom edge; the words never run under the button.
    bottom: { flexDirection: 'row', alignItems: 'center' },
    meta: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { flexShrink: 1, fontSize: 13, fontFamily: FontFamily.medium },
    plan: { width: Control.hitTarget, height: Control.hitTarget, alignItems: 'center', justifyContent: 'center' },
});
