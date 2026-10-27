import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { PopIn } from '@/components/ui/Motion';
import { DropTarget } from '@/components/ui/DragDrop';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { contrastRatio } from '@/lib/colorContrast';
import { monthGrid, type GoalDay, type GoalDayItem } from '@/lib/goalPlanPeriod';

const dateOf = (key: string) => new Date(`${key}T12:00:00`);
const KIND: Record<GoalDayItem['kind'], string> = { habit: 'Habit', task: 'Task', milestone: 'Milestone' };

/** What a mark is drawn in: habits in the goal's colour, tasks amber, milestones in plain ink. */
function useKindColor(color: string) {
    const t = useTokens();
    return (kind: GoalDayItem['kind']) => (kind === 'habit' ? color : kind === 'task' ? t.color.warning : t.color.textPrimary);
}

/**
 * One day of a goal's plan, as a card: the day's name, and every habit, task
 * and milestone it asks for, each with the mark it has across Habyss (a round
 * check for a habit, a square for a task, a flag for a milestone). Ticking
 * works where it means something: a habit today, a task or a milestone any
 * day. An empty day says it is free, and a day still to come offers to plan a
 * task on it, so the week reads as a page to plan on.
 */
export function GoalDayCard({ day, today, color, readOnly, onToggle, onOpen, onAddTask }: {
    day: GoalDay;
    today: string;
    color: string;
    readOnly?: boolean;
    onToggle: (item: GoalDayItem) => void;
    onOpen: (item: GoalDayItem) => void;
    onAddTask?: (day: string) => void;
}) {
    const t = useTokens();
    const isToday = day.day === today;
    const done = day.items.filter(item => item.done).length;
    const date = dateOf(day.day);
    return (
        <MatteSurface radius={Radius.card} style={styles.card}>
            <View style={styles.cardHead} accessibilityRole="header">
                <Text style={[styles.weekday, { color: isToday ? color : t.color.textPrimary }]}>
                    {isToday ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'long' })}
                </Text>
                <Text style={[styles.date, { color: t.color.textMuted }]}>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                <View style={styles.spacer} />
                {day.items.length ? <Text style={[styles.count, { color: done === day.items.length ? t.color.success : t.color.textMuted }]}>{`${done} of ${day.items.length}`}</Text> : null}
            </View>
            {day.items.length ? day.items.map(item => (
                <GoalItemLine key={`${item.kind}:${item.id}`} item={item} color={color}
                    canTick={!readOnly && (item.kind !== 'habit' || isToday)} onToggle={() => onToggle(item)} onOpen={() => onOpen(item)} />
            )) : (
                <Text style={[styles.free, { color: t.color.textMuted }]}>Nothing planned. A free day.</Text>
            )}
            {onAddTask && !readOnly && day.day >= today ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Plan a task on ${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`}
                    onPress={() => onAddTask(day.day)} style={styles.add} hitSlop={4}>
                    <Ionicons name="add" size={18} color={t.color.textMuted} />
                    <Text style={[styles.addText, { color: t.color.textMuted }]}>Plan a task</Text>
                </Pressable>
            ) : null}
        </MatteSurface>
    );
}

function GoalItemLine({ item, color, canTick, onToggle, onOpen }: {
    item: GoalDayItem; color: string; canTick: boolean; onToggle: () => void; onOpen: () => void;
}) {
    const t = useTokens();
    const tone = useKindColor(color)(item.kind);
    const tick = contrastRatio(tone, t.color.background) > contrastRatio(tone, t.color.textPrimary) ? t.color.background : t.color.textPrimary;
    const mark = item.kind === 'milestone' ? (
        <Ionicons name={item.done ? 'flag' : 'flag-outline'} size={18} color={tone} />
    ) : (
        <View style={[styles.mark, item.kind === 'habit' ? styles.round : styles.square,
            { borderColor: tone, backgroundColor: item.done ? tone : 'transparent', opacity: canTick || item.done ? 1 : 0.55 }]}>
            {item.done ? <Ionicons name="checkmark" size={14} color={tick} /> : null}
        </View>
    );
    return (
        <View style={styles.line}>
            {canTick ? (
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.done }}
                    accessibilityLabel={`${KIND[item.kind]}: ${item.title}`} onPress={onToggle} style={styles.markButton}>
                    {mark}
                </Pressable>
            ) : <View style={styles.markButton} accessibilityElementsHidden>{mark}</View>}
            <Pressable accessibilityRole="button" accessibilityLabel={`${KIND[item.kind]}: ${item.title}${item.done ? ', done' : ''}. Open`}
                onPress={onOpen} style={styles.lineText}>
                <Text numberOfLines={2} style={[styles.title, { color: item.done ? t.color.textMuted : t.color.textPrimary, textDecorationLine: item.done && item.kind !== 'habit' ? 'line-through' : 'none' }]}>
                    {item.title}
                </Text>
                <Text style={[styles.kind, { color: t.color.textSubtle }]}>{KIND[item.kind]}</Text>
            </Pressable>
        </View>
    );
}

/**
 * A month of a goal as a calendar: every day a cell with its date and one
 * small bar for each thing it asks (solid once done, faint until then), in
 * the colour of its kind. Tapping a day picks it; the day's card shows under
 * the grid, the way Calendar's month view works. Days outside the goal (before
 * it started, after its deadline) are not drawn, and a week with none of the
 * goal's days is left out, so the calendar runs from its first day to its last.
 */
export function GoalMonth({ month, days, selected, today, color, weekStartsMonday, inRange, onSelect, title, droppable, still, compact }: {
    /** Any day in the month, YYYY-MM-DD. */
    month: string;
    days: Record<string, GoalDay>;
    selected: string | null;
    today: string;
    color: string;
    weekStartsMonday: boolean;
    inRange: (day: string) => boolean;
    onSelect: (day: string) => void;
    title?: string;
    /** Days a carried to-do can be put down on (see DragDrop). */
    droppable?: (day: string) => boolean;
    /** No pop-in: many months drawn at once (the day picker). */
    still?: boolean;
    /** Squarer, shorter days. */
    compact?: boolean;
}) {
    const t = useTokens();
    const kindColor = useKindColor(color);
    const letters = weekStartsMonday ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const rows = monthGrid(month, weekStartsMonday).filter(row => row.some(key => !!key && inRange(key)));
    return (
        <View style={styles.month}>
            {title ? <Text style={[styles.monthTitle, { color: t.color.textPrimary }]} accessibilityRole="header">{title}</Text> : null}
            <View style={styles.row}>
                {letters.map((letter, index) => (
                    <Text key={index} style={[styles.letter, { color: t.color.textSubtle }]} importantForAccessibility="no">{letter}</Text>
                ))}
            </View>
            {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                    {row.map((key, column) => {
                        if (!key || !inRange(key)) return <View key={column} style={[styles.cell, compact && styles.cellCompact]} />;
                        const day = days[key];
                        const items = day?.items ?? [];
                        const isSelected = key === selected;
                        const isToday = key === today;
                        const shown = items.slice(0, 4);
                        const label = `${dateOf(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}. `
                            + (items.length ? items.map(item => `${item.title}${item.done ? ', done' : ''}`).join('; ') : 'Nothing planned');
                        const cell = (
                            <Pressable key={key} onPress={() => onSelect(key)} style={[styles.cell, compact && styles.cellCompact]}
                                accessibilityRole="button" accessibilityState={{ selected: isSelected }} accessibilityLabel={label}>
                                <PopIn index={still ? 0 : rowIndex * 7 + column} still={still} style={[styles.cellInner,
                                    isSelected ? { backgroundColor: t.color.surfaceRaised, borderColor: color } : { borderColor: 'transparent' }]}>
                                    <Text style={[styles.dayNumber, { color: isToday ? color : t.color.textPrimary, fontFamily: isToday || isSelected ? FontFamily.bold : FontFamily.medium }]}>
                                        {Number(key.slice(8))}
                                    </Text>
                                    <View style={styles.bars}>
                                        {shown.map(item => (
                                            <View key={`${item.kind}:${item.id}`} style={[styles.bar, { backgroundColor: kindColor(item.kind), opacity: item.done ? 1 : 0.35 }]} />
                                        ))}
                                        {items.length > shown.length ? <Text style={[styles.more, { color: t.color.textMuted }]}>{`+${items.length - shown.length}`}</Text> : null}
                                    </View>
                                </PopIn>
                            </Pressable>
                        );
                        return droppable ? (
                            <DropTarget key={key} id={key} accepts={droppable(key)} radius={Radius.small} style={styles.cell}>{cell}</DropTarget>
                        ) : cell;
                    })}
                </View>
            ))}
        </View>
    );
}

/** What the bars in the grid mean, in one line under it. */
export function GoalMonthKey({ color }: { color: string }) {
    const t = useTokens();
    const kindColor = useKindColor(color);
    return (
        <View style={styles.key} accessibilityLabel="Each bar is one thing that day: habits, tasks and milestones. Solid once done.">
            {(['habit', 'task', 'milestone'] as const).map(kind => (
                <View key={kind} style={styles.keyItem}>
                    <View style={[styles.keyBar, { backgroundColor: kindColor(kind) }]} />
                    <Text style={[styles.keyText, { color: t.color.textMuted }]}>{`${KIND[kind]}s`}</Text>
                </View>
            ))}
            <Text style={[styles.keyText, { color: t.color.textSubtle }]}>Solid once done</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.lg, gap: Spacing.xs },
    cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginBottom: Spacing.xs },
    weekday: { fontSize: 17, fontFamily: FontFamily.bold },
    date: { fontSize: 15, fontFamily: FontFamily.medium },
    spacer: { flex: 1 },
    count: { fontSize: 13, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    free: { fontSize: 15, fontFamily: FontFamily.regular, paddingVertical: Spacing.xs },
    line: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    markButton: { width: 44, height: 44, marginLeft: -Spacing.md + 2, alignItems: 'center', justifyContent: 'center' },
    mark: { width: 22, height: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    round: { borderRadius: 11 },
    square: { borderRadius: 6 },
    lineText: { flex: 1, minHeight: 44, justifyContent: 'center', paddingVertical: Spacing.xs },
    title: { fontSize: 15, fontFamily: FontFamily.medium },
    kind: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 1 },
    add: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: 44, alignSelf: 'flex-start' },
    addText: { fontSize: 15, fontFamily: FontFamily.medium },
    month: { gap: Spacing.xs },
    monthTitle: { fontSize: 17, fontFamily: FontFamily.bold, marginBottom: Spacing.xs },
    row: { flexDirection: 'row' },
    letter: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: FontFamily.semibold, paddingBottom: Spacing.xs },
    cell: { flex: 1, aspectRatio: 0.82, padding: 2 },
    cellCompact: { aspectRatio: 1 },
    cellInner: { flex: 1, borderRadius: Radius.small, borderWidth: 1.5, alignItems: 'center', paddingTop: Spacing.xs, gap: Spacing.xs },
    dayNumber: { fontSize: 15, fontVariant: ['tabular-nums'] },
    bars: { alignSelf: 'stretch', paddingHorizontal: 6, gap: 3, alignItems: 'center' },
    bar: { alignSelf: 'stretch', height: 4, borderRadius: 2 },
    more: { fontSize: 11, fontFamily: FontFamily.semibold, lineHeight: 12 },
    key: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xs },
    keyItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    keyBar: { width: 14, height: 4, borderRadius: 2 },
    keyText: { fontSize: 12, fontFamily: FontFamily.medium },
});
