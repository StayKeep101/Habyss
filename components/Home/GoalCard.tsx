import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
// The gesture handler's Pressable, like the other rows in the list, so the
// chevron is never lost to the card around it.
import { Pressable } from 'react-native-gesture-handler';
import { SharedFaces } from '@/components/Common/SharedFaces';
import type { SharedState } from '@/lib/shared';
import { AnimatedCircle, CountUp, useProgress } from '@/components/ui/Motion';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useAccentGradient } from '@/context/AccentContext';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import type { Habit } from '@/lib/habitsSQLite';
import type { RoadMapCardSize } from '@/context/AppSettingsContext';

interface GoalCardProps {
    goal: Habit;
    progress: number;
    onPress: () => void;
    size: RoadMapCardSize;
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
 * A goal on the Roadmap, as one quiet card: its icon inside a ring of how far
 * it has come (the only thing in the goal's own colour), its name, one line
 * of when it is due and what it holds, the figure, and a chevron that opens
 * its habits. A deadline today or past reads in amber, never in alarm red.
 */
export const GoalCard: React.FC<GoalCardProps> = ({
    goal, progress, onPress, size, isExpanded, onToggleExpand, linkedHabitsCount, shared, isDropTarget = false,
}) => {
    const t = useTokens();
    const { primary } = useAccentGradient();
    const color = goal.color || primary;
    const days = daysUntil(goal.targetDate);
    const isSmall = size === 'small';
    const isBig = size === 'big';
    const ring = isSmall ? 36 : isBig ? 52 : 44;
    const stroke = isSmall ? 3 : 3.5;
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

    return (
        <MatteSurface radius={Radius.card} style={[styles.card, isDropTarget && { borderWidth: 1.5, borderColor: color }]}>
            <Pressable onPress={onPress} style={[styles.main, { paddingVertical: isSmall ? Spacing.sm : Spacing.md }]}
                accessibilityRole="button" accessibilityLabel={`${goal.name}, ${Math.round(progress)}% done. ${due}. ${holds}. Open`}>
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

                <View style={styles.text}>
                    <Text numberOfLines={1} style={[styles.name, { color: t.color.textPrimary, fontSize: isSmall ? 15 : isBig ? 18 : 16 }]}>{goal.name}</Text>
                    <View style={styles.meta}>
                        {urgent ? <Ionicons name="flag" filled size={11} color={t.color.warning} /> : null}
                        <Text numberOfLines={1} style={[styles.metaText, styles.due, { color: urgent ? t.color.warning : t.color.textMuted }]}>{due}</Text>
                        {linkedHabitsCount ? <Text numberOfLines={1} style={[styles.metaText, { color: t.color.textSubtle }]}>{`· ${holds}`}</Text> : null}
                    </View>
                </View>

                {shared ? <SharedFaces people={shared.people} tint={color} size={22} /> : null}
                <CountUp style={[styles.percent, { color: t.color.textPrimary }]} value={`${Math.round(progress)}%`} />
            </Pressable>

            <Pressable onPress={onToggleExpand} style={styles.chevron} hitSlop={4}
                accessibilityRole="button" accessibilityState={{ expanded: isExpanded }}
                accessibilityLabel={`${isExpanded ? 'Hide' : 'Show'} its ${holds}`}>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={t.color.textMuted} />
            </Pressable>
        </MatteSurface>
    );
};

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing.md },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    // Its words stay in their column: the percent and chevron never sit on them.
    text: { flex: 1, minWidth: 0, gap: 2 },
    name: { fontFamily: FontFamily.semibold },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, fontFamily: FontFamily.medium },
    due: { flexShrink: 1 },
    percent: { fontSize: 15, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    chevron: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.xs },
});
