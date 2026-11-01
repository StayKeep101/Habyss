import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, ChoicePill, IconButton, ListItem, Text, VoidSheet } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import type { VoiceItem } from '@/lib/voicePlan';
import type { VoiceKind } from '@/lib/voiceIntent';
import { Radius, Spacing } from '@/theme/designSystem';

const KINDS: { id: VoiceKind; label: string; icon: string }[] = [
    { id: 'task', label: 'Task', icon: 'checkbox' },
    { id: 'habit', label: 'Habit', icon: 'repeat' },
    { id: 'goal', label: 'Goal', icon: 'flag' },
];

/**
 * What was heard, spoken freely: each thing in it as a task, a habit or a
 * goal (tap to say otherwise, or take it out), then one button for all of it.
 * Closed without adding, it all goes to the brain dump: a thought said out
 * loud is never lost.
 */
export function VoicePlanSheet({ items, onAdd, onKeep }: { items: VoiceItem[]; onAdd: (items: VoiceItem[]) => void; onKeep: (items: VoiceItem[]) => void }) {
    const t = useTokens();
    const { selectionFeedback, successFeedback } = useHaptics();
    const [list, setList] = useState(items);
    const tasks = list.filter(item => item.kind === 'task').length;
    const rest = list.length - tasks;
    const label = list.length === 0 ? 'Nothing to add'
        : rest === 0 ? `Add ${tasks === 1 ? 'the task' : `${tasks} tasks`}`
        : `Add all ${list.length}`;
    return (
        <VoidSheet visible onClose={() => onKeep(list)} title="Here’s what I heard" caption={`${list.length} ${list.length === 1 ? 'thing' : 'things'}`} scrollable
            footer={
                <View style={styles.footer}>
                    <AppButton label={label} icon="checkmark" disabled={!list.length} onPress={() => { successFeedback(); onAdd(list); }} />
                    {rest ? <Text variant="caption" tone="muted" align="center">Tasks are added now; each habit and goal opens ready to save.</Text> : null}
                </View>
            }>
            <View style={styles.list}>
                {list.map((item, index) => (
                    <ListItem key={`${item.text}-${index}`}>
                        <View style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}>
                            <View style={styles.head}>
                                <View style={styles.grow}><Text variant="heading">{item.text}</Text></View>
                                <IconButton icon="close" label={`Take out ${item.text}`} size={18} color={t.color.textMuted}
                                    onPress={() => { selectionFeedback(); setList(current => current.filter((_, at) => at !== index)); }} />
                            </View>
                            <View style={styles.kinds}>
                                {KINDS.map(kind => (
                                    <ChoicePill key={kind.id} label={kind.label} icon={kind.icon} on={item.kind === kind.id} color={t.color.accent} radius={Radius.pill}
                                        onPress={() => { selectionFeedback(); setList(current => current.map((entry, at) => (at === index ? { ...entry, kind: kind.id } : entry))); }} />
                                ))}
                            </View>
                        </View>
                    </ListItem>
                ))}
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    list: { paddingBottom: Spacing.md },
    row: { paddingVertical: Spacing.md, gap: Spacing.sm },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    grow: { flex: 1 },
    kinds: { flexDirection: 'row', gap: Spacing.sm },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.sm },
});
