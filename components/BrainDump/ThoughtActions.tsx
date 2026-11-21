import { GOALS_ENABLED } from '@/constants/features';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { IconTile } from '@/components/ui/IconTile';
import { IconButton } from '@/components/ui/IconButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { Control, FontFamily, Spacing } from '@/theme/designSystem';

export type ThoughtAction = 'task' | 'habit' | 'goal' | 'copy' | 'share';

/** A small icon in the sheet's corner: still a full 44 pt to tap. */
const CORNER = Control.hitTarget - 8;

/**
 * What a held thought (or several selected ones) can become, as a small sheet
 * from the bottom. Five tiles: a Task, a Habit, a Goal; into one of your goals
 * (a task under it); or a subtask of a task you already have. Copy and Share
 * are small icons beside the title. Choosing a goal or a task swaps the sheet's
 * content for the list to pick from, rather than opening anything else.
 */
export function ThoughtActions({ visible, count, caption, goals, tasks, startWithGoals, onClose, onAction, onAddToGoal, onAddSubtask }: {
    visible: boolean;
    /** How many thoughts this is for. */
    count: number;
    /** The thought's words, for one; nothing for several. */
    caption?: string;
    goals: { id: string; name: string; color?: string; icon?: string }[];
    /** Open tasks a thought can go under as a subtask. */
    tasks: { id: string; title: string }[];
    /** Opened straight on the goal list (from the selection menu). */
    startWithGoals?: boolean;
    onClose: () => void;
    onAction: (action: ThoughtAction) => void;
    onAddToGoal: (goalId: string) => void;
    onAddSubtask: (taskId: string) => void;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [picking, setPicking] = useState<'goal' | 'task' | null>(null);
    useEffect(() => { if (visible) setPicking(startWithGoals ? 'goal' : null); }, [visible, startWithGoals]);
    const many = count > 1;
    const tiles: { id: ThoughtAction | 'into_goal' | 'subtask'; label: string; icon: string; color: string }[] = [
        { id: 'task', label: many ? `${count} tasks` : 'Task', icon: 'checkbox', color: t.color.warning },
        { id: 'habit', label: many ? `${count} habits` : 'Habit', icon: 'repeat', color: t.color.accent },
        // Goals are off for now (constants/features.ts).
        ...(GOALS_ENABLED ? [
            { id: 'goal' as const, label: many ? `${count} goals` : 'Goal', icon: 'flag', color: t.color.success },
            { id: 'into_goal' as const, label: 'Into a goal', icon: 'flag-outline', color: t.color.success },
        ] : []),
        { id: 'subtask', label: 'Subtask', icon: 'list', color: t.color.warning },
    ];
    const press = (id: typeof tiles[number]['id']) => {
        selectionFeedback();
        if (id === 'into_goal') setPicking('goal');
        else if (id === 'subtask') setPicking('task');
        else onAction(id);
    };

    const list = (rows: { id: string; label: string; icon: string; color: string }[], empty: string, onPick: (id: string) => void) => (
        <ScrollView style={styles.list} bounces={false}>
            {rows.length ? rows.map(row => (
                <Pressable key={row.id} accessibilityRole="button" onPress={() => { selectionFeedback(); onPick(row.id); }}
                    style={[styles.listRow, { gap: t.space.md, paddingVertical: t.space.md, borderTopColor: t.color.border }]}>
                    <IconTile icon={row.icon} color={row.color} size={30} />
                    <Text numberOfLines={1} style={[t.type.body, styles.flex, { color: t.color.textPrimary }]}>{row.label}</Text>
                    <AppIcon name="chevron-forward" size={16} color={t.color.textSubtle} />
                </Pressable>
            )) : <Text style={[t.type.bodySmall, { color: t.color.textSubtle }]}>{empty}</Text>}
        </ScrollView>
    );

    return (
        <VoidSheet visible={visible} onClose={onClose}
            title={picking === 'goal' ? 'Into a goal' : picking === 'task' ? 'Subtask of' : many ? `${count} thoughts` : 'Turn into'}
            caption={caption && caption.length > 80 ? `${caption.slice(0, 80)}…` : caption}
            accessory={picking ? (
                <IconButton icon="chevron-back" label="Back" diameter={CORNER} onPress={() => { selectionFeedback(); setPicking(null); }} />
            ) : (
                <View style={[styles.corner, { gap: t.space.xs }]}>
                    <IconButton icon="copy-outline" label="Copy" diameter={CORNER} size={16} onPress={() => { selectionFeedback(); onAction('copy'); }} />
                    <IconButton icon="share-outline" label="Share to another app" diameter={CORNER} size={16} onPress={() => { selectionFeedback(); onAction('share'); }} />
                </View>
            )}>
            {picking === 'goal' ? list(goals.map(goal => ({ id: goal.id, label: goal.name, icon: goal.icon || 'flag', color: goal.color || t.color.accent })),
                'No goals yet. Make one first, then file thoughts under it.', onAddToGoal)
                : picking === 'task' ? list(tasks.map(task => ({ id: task.id, label: task.title, icon: 'checkbox', color: t.color.warning })),
                    'No open tasks to add it under.', onAddSubtask)
                    : (
                        <View style={[styles.tiles, { gap: t.space.sm }]}>
                            {tiles.map(tile => (
                                <Pressable key={tile.id} style={styles.tileCell} accessibilityRole="button"
                                    accessibilityLabel={tile.id === 'into_goal' ? 'Add to a goal' : tile.id === 'subtask' ? 'Add as a subtask of a task' : `Make ${tile.label.toLowerCase()}`}
                                    onPress={() => press(tile.id)}>
                                    <MatteSurface radius={t.radius.lg} level="control" style={[styles.tile, { gap: t.space.sm, paddingVertical: t.space.md }]}>
                                        <IconTile icon={tile.icon} color={tile.color} size={36} />
                                        <Text numberOfLines={1} style={[t.type.caption, styles.tileLabel, { color: t.color.textPrimary }]}>{tile.label}</Text>
                                    </MatteSurface>
                                </Pressable>
                            ))}
                        </View>
                    )}
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    corner: { flexDirection: 'row' },
    /** Three to a row, so every name fits. */
    tiles: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
    tileCell: { flexBasis: '30%', flexGrow: 1 },
    tile: { alignItems: 'center' },
    tileLabel: { fontFamily: FontFamily.semibold },
    list: { maxHeight: 360, paddingHorizontal: Spacing.lg },
    listRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
});
