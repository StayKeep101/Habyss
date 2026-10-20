import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { IconTile } from '@/components/ui/IconTile';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { FontFamily } from '@/theme/designSystem';

export type ThoughtAction = 'task' | 'habit' | 'goal' | 'copy';

/**
 * What a held thought (or several selected ones) can become, as a small sheet
 * from the bottom: four tiles — Task, Habit, Goal, Copy — and, under them,
 * filing it under one of your goals. Picking a goal swaps the sheet's content
 * for the list of goals rather than opening anything else.
 */
export function ThoughtActions({ visible, count, caption, goals, startWithGoals, onClose, onAction, onAddToGoal }: {
    visible: boolean;
    /** How many thoughts this is for. */
    count: number;
    /** The thought's words, for one; nothing for several. */
    caption?: string;
    goals: { id: string; name: string; color?: string; icon?: string }[];
    /** Opened straight on the goal list (from the selection menu). */
    startWithGoals?: boolean;
    onClose: () => void;
    onAction: (action: ThoughtAction) => void;
    onAddToGoal: (goalId: string) => void;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [picking, setPicking] = useState(false);
    useEffect(() => { if (visible) setPicking(!!startWithGoals); }, [visible, startWithGoals]);
    const many = count > 1;
    const tiles: { id: ThoughtAction; label: string; icon: string; color: string }[] = [
        { id: 'task', label: many ? `${count} tasks` : 'Task', icon: 'checkbox', color: t.color.warning },
        { id: 'habit', label: many ? `${count} habits` : 'Habit', icon: 'repeat', color: t.color.accent },
        { id: 'goal', label: many ? `${count} goals` : 'Goal', icon: 'flag', color: t.color.success },
        { id: 'copy', label: 'Copy', icon: 'copy', color: t.color.textMuted },
    ];

    return (
        <VoidSheet visible={visible} onClose={onClose} title={picking ? 'Add to a goal' : many ? `${count} thoughts` : 'Turn into'}
            caption={caption && caption.length > 80 ? `${caption.slice(0, 80)}…` : caption}>
            {picking ? (
                <ScrollView style={styles.goals} bounces={false}>
                    {goals.length ? goals.map(goal => (
                        <Pressable key={goal.id} accessibilityRole="button" onPress={() => { selectionFeedback(); onAddToGoal(goal.id); }}
                            style={[styles.goalRow, { gap: t.space.md, paddingVertical: t.space.md, borderTopColor: t.color.border }]}>
                            <IconTile icon={goal.icon || 'flag'} color={goal.color || t.color.accent} size={30} />
                            <Text numberOfLines={1} style={[t.type.body, styles.flex, { color: t.color.textPrimary }]}>{goal.name}</Text>
                            <AppIcon name="chevron-forward" size={16} color={t.color.textSubtle} />
                        </Pressable>
                    )) : (
                        <Text style={[t.type.bodySmall, { color: t.color.textSubtle }]}>No goals yet. Make one first, then file thoughts under it.</Text>
                    )}
                </ScrollView>
            ) : (
                <View style={{ gap: t.space.md }}>
                    <View style={[styles.tiles, { gap: t.space.sm }]}>
                        {tiles.map(tile => (
                            <Pressable key={tile.id} style={styles.flex} accessibilityRole="button" accessibilityLabel={tile.id === 'copy' ? 'Copy' : `Make ${tile.label.toLowerCase()}`}
                                onPress={() => { selectionFeedback(); onAction(tile.id); }}>
                                <MatteSurface radius={t.radius.lg} level="control" style={[styles.tile, { gap: t.space.sm, paddingVertical: t.space.md }]}>
                                    <IconTile icon={tile.icon} color={tile.color} size={36} />
                                    <Text numberOfLines={1} style={[t.type.caption, styles.tileLabel, { color: t.color.textPrimary }]}>{tile.label}</Text>
                                </MatteSurface>
                            </Pressable>
                        ))}
                    </View>
                    <Pressable accessibilityRole="button" onPress={() => { selectionFeedback(); setPicking(true); }}>
                        <MatteSurface radius={t.radius.lg} level="control" style={[styles.addRow, { gap: t.space.md, padding: t.space.md }]}>
                            <AppIcon name="flag-outline" size={18} color={t.color.textPrimary} />
                            <Text style={[t.type.body, styles.flex, { color: t.color.textPrimary }]}>Add to a goal</Text>
                            <AppIcon name="chevron-forward" size={16} color={t.color.textSubtle} />
                        </MatteSurface>
                    </Pressable>
                </View>
            )}
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    tiles: { flexDirection: 'row' },
    tile: { alignItems: 'center' },
    tileLabel: { fontFamily: FontFamily.semibold },
    goals: { maxHeight: 360 },
    goalRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
    addRow: { flexDirection: 'row', alignItems: 'center' },
});
