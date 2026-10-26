import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { IconButton } from '@/components/ui/IconButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { generateId } from '@/lib/database';
import type { Subtask } from '@/lib/tasks';

/**
 * A task's steps: tick each as it is done, add one by typing and pressing
 * return, take one away with its ×. The task itself is still ticked on its own.
 */
export function SubtaskEditor({ steps, onChange, color }: { steps: Subtask[]; onChange: (steps: Subtask[]) => void; color: string }) {
    const t = useTokens();
    const { selectionFeedback, lightFeedback } = useHaptics();
    const [draft, setDraft] = useState('');
    const add = () => {
        const title = draft.trim();
        if (!title) return;
        onChange([...steps, { id: generateId(), title, done: false }]);
        setDraft('');
        lightFeedback();
    };
    return (
        <View style={styles.wrap}>
            {steps.map(step => (
                <View key={step.id} style={styles.row}>
                    <Pressable hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: step.done }} accessibilityLabel={step.title}
                        onPress={() => { selectionFeedback(); onChange(steps.map(item => item.id === step.id ? { ...item, done: !item.done } : item)); }}
                        style={[styles.check, { borderColor: step.done ? color : t.color.textMuted, backgroundColor: step.done ? color : 'transparent' }]}>
                        {step.done ? <AppIcon name="checkmark" size={13} color={t.color.onAccent} /> : null}
                    </Pressable>
                    <Text style={[styles.title, step.done && styles.struck, { color: step.done ? t.color.textMuted : t.color.textPrimary }]}>{step.title}</Text>
                    <IconButton icon="close" label={`Remove ${step.title}`} size={14} onPress={() => { lightFeedback(); onChange(steps.filter(item => item.id !== step.id)); }} />
                </View>
            ))}
            <MatteInput value={draft} onChangeText={setDraft} placeholder={steps.length ? 'Add another step' : 'Add a step'} returnKeyType="done"
                blurOnSubmit={false} onSubmitEditing={add} accessibilityLabel="New step" />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium },
    struck: { textDecorationLine: 'line-through' },
});
