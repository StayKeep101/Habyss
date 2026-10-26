import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AnimatedFill, ListItem } from '@/components/ui/Motion';
import { CheckPop } from '@/components/ui/CheckPop';
import { AppIcon } from '@/components/ui/AppIcon';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ValuePill } from '@/components/Goal/GoalRows';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { milestoneStates, type Milestone, type MilestoneState } from '@/lib/goalMilestones';

/** Shown at once around the next one; the rest behind "Show all". */
const AROUND = 5;
const MARK = 28;

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);

function whenLabel(milestone: Milestone, state: MilestoneState, today: string): string {
    if (state === 'done') return 'Reached';
    if (!milestone.dueDate) return state === 'next' ? 'Next' : 'No date';
    const days = dayDiff(today, milestone.dueDate);
    const date = new Date(`${milestone.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (state === 'late') return `${-days} ${-days === 1 ? 'day' : 'days'} late · ${date}`;
    if (days === 0) return `${state === 'next' ? 'Next · ' : ''}Today`;
    if (days === 1) return `${state === 'next' ? 'Next · ' : ''}Tomorrow`;
    return `${state === 'next' ? 'Next · ' : ''}${date} · in ${days} days`;
}

/**
 * A goal's milestones as a short path: a flag for each, joined by a line in
 * the goal's colour. Reached ones are filled, the next one is ringed, a late
 * one says so in red. Tap the flag to reach it (or take it back), the row to
 * change it. Only on the goal: milestones never reach the timeline or a list.
 */
export function GoalMilestones({ milestones, color, today, onToggle, onOpen }: {
    milestones: Milestone[];
    color: string;
    today: string;
    onToggle: (milestone: Milestone) => void;
    onOpen: (milestone: Milestone) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { successFeedback, lightFeedback } = useHaptics();
    const [all, setAll] = useState(false);
    const states = useMemo(() => milestoneStates(milestones, today), [milestones, today]);
    const reached = milestones.filter(milestone => milestone.doneAt).length;
    // Around the next one: a couple reached before it, the rest ahead.
    const shown = useMemo(() => {
        if (all || milestones.length <= AROUND) return milestones;
        const next = Math.max(0, milestones.findIndex(milestone => states[milestone.id] === 'next' || states[milestone.id] === 'late'));
        const from = Math.max(0, Math.min(next - 1, milestones.length - AROUND));
        return milestones.slice(from, from + AROUND);
    }, [all, milestones, states]);

    if (!milestones.length) return null;
    return (
        <View style={styles.wrap}>
            <SectionTitle first right={<ValuePill value={`${reached}/${milestones.length}`} />}>Milestones</SectionTitle>
            <View style={[styles.track, { backgroundColor: colors.border }]} accessible accessibilityRole="progressbar"
                accessibilityLabel={`${reached} of ${milestones.length} milestones reached`}>
                <AnimatedFill progress={reached / milestones.length} replay={reached} style={[styles.fill, { backgroundColor: color }]} />
            </View>
            <MatteSurface radius={18} style={styles.card}>
                {shown.map((milestone, index) => {
                    const state = states[milestone.id];
                    const done = state === 'done';
                    const late = state === 'late';
                    const last = index === shown.length - 1;
                    return (
                        <ListItem key={milestone.id}>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightFeedback(); onOpen(milestone); }} style={styles.row}
                                accessibilityRole="button" accessibilityLabel={`Milestone: ${milestone.title}. ${whenLabel(milestone, state, today)}`}
                                accessibilityHint="Opens it to change the name or date">
                                <View style={styles.rail}>
                                    <TouchableOpacity hitSlop={(44 - MARK) / 2} onPress={() => { if (done) lightFeedback(); else successFeedback(); onToggle(milestone); }}
                                        accessibilityRole="checkbox" accessibilityState={{ checked: done }}
                                        accessibilityLabel={done ? `Take back ${milestone.title}` : `Mark ${milestone.title} reached`}>
                                        <CheckPop active={done} color={color} size={MARK}>
                                            <View style={[styles.mark, {
                                                backgroundColor: done ? color : 'transparent',
                                                borderColor: late ? colors.error : state === 'next' || done ? color : colors.textTertiary,
                                                borderWidth: state === 'next' ? 2.5 : 1.5,
                                            }]}>
                                                <AppIcon name={done ? 'checkmark' : 'flag'} filled size={13} color={done ? textOn(color) : late ? colors.error : state === 'next' ? color : colors.textTertiary} />
                                            </View>
                                        </CheckPop>
                                    </TouchableOpacity>
                                    {!last ? <View style={[styles.link, { backgroundColor: done ? color : colors.border }]} /> : null}
                                </View>
                                <View style={styles.text}>
                                    <Text numberOfLines={2} style={[styles.title, done && styles.struck, { color: done ? colors.textTertiary : colors.textPrimary }]}>{milestone.title}</Text>
                                    <Text numberOfLines={1} style={[styles.meta, { color: late ? colors.error : state === 'next' ? color : colors.textTertiary }]}>{whenLabel(milestone, state, today)}</Text>
                                </View>
                            </TouchableOpacity>
                        </ListItem>
                    );
                })}
                {milestones.length > AROUND ? (
                    <TouchableOpacity onPress={() => { lightFeedback(); setAll(value => !value); }} style={styles.more} accessibilityRole="button">
                        <Text style={[styles.moreText, { color: colors.textSecondary }]}>{all ? 'Show fewer' : `Show all ${milestones.length}`}</Text>
                        <AppIcon name={all ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                ) : null}
            </MatteSurface>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    track: { height: 4, borderRadius: 2, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 2 },
    card: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.md, minHeight: 56 },
    rail: { width: MARK, alignItems: 'center' },
    mark: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center' },
    link: { width: 2, flex: 1, minHeight: 12, borderRadius: 1, marginVertical: 2 },
    text: { flex: 1, paddingTop: 3, paddingBottom: Spacing.md, gap: 2 },
    title: { fontFamily: FontFamily.semibold, fontSize: 15 },
    struck: { textDecorationLine: 'line-through' },
    meta: { fontFamily: FontFamily.medium, fontSize: 13 },
    more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 },
    moreText: { fontFamily: FontFamily.medium, fontSize: 13 },
});
