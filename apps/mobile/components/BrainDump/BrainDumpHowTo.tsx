import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, AppIcon, Text, VoidSheet } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { Radius, Spacing } from '@/theme/designSystem';

/**
 * How the brain dump works, opened from its info button: every gesture, one
 * line each, and when it clears. Export sits at the foot (everything, by day,
 * out to Notes, Notion, Obsidian or anywhere).
 */
export function BrainDumpHowTo({ visible, clearsOn, onClose, onExport }: {
    visible: boolean;
    /** The night it empties itself ("Sunday"), when it does. */
    clearsOn: string | null;
    onClose: () => void;
    onExport?: () => void;
}) {
    const t = useTokens();
    // Each gesture in a word or two, what it does under it, muted.
    const lines: { icon: string; gesture: string; does: string }[] = [
        { icon: 'create', gesture: 'Type or talk', does: 'Send it, or tap the mic' },
        { icon: 'hand-left', gesture: 'Tap', does: 'Reword it' },
        { icon: 'finger-print', gesture: 'Hold', does: 'Make it a task or habit, copy, delete' },
        { icon: 'reorder-three', gesture: 'Hold and drag', does: 'Move it' },
        { icon: 'arrow-back', gesture: 'Swipe left', does: 'Delete, with undo' },
        { icon: 'checkmark-done', gesture: 'Two fingers down', does: 'Select several' },
        ...(clearsOn ? [{ icon: 'moon', gesture: `Clears ${clearsOn} night`, does: 'Every week starts empty' }] : []),
        { icon: 'lock-closed', gesture: 'Private', does: 'Stays on this phone' },
    ];
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Brain dump"
            footer={onExport ? <View style={styles.foot}><AppButton label="Export everything" icon="share-outline" onPress={onExport} /></View> : undefined}>
            <View style={styles.body}>
                {lines.map(line => (
                    <View key={line.gesture} style={styles.line} accessible accessibilityLabel={`${line.gesture}: ${line.does}`}>
                        <View style={[styles.chip, { backgroundColor: t.tint('subtle', t.color.accentText) }]}>
                            <AppIcon name={line.icon as never} filled size={Spacing.lg} color={t.color.accentText} />
                        </View>
                        <View style={styles.words}>
                            <Text variant="heading" numberOfLines={1}>{line.gesture}</Text>
                            <Text variant="bodySmall" tone="muted" numberOfLines={2}>{line.does}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { paddingHorizontal: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.sm },
    line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    chip: { width: Spacing.section + Spacing.xs, height: Spacing.section + Spacing.xs, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    words: { flex: 1, gap: Spacing.xs / 2 },
    foot: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
