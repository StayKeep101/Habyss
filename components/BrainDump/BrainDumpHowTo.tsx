import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, AppIcon, Text, VoidSheet } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { Spacing } from '@/theme/designSystem';

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
    const lines: { icon: string; text: string }[] = [
        { icon: 'create', text: 'Type at the bottom and send. Nothing typed: the mic, to say it.' },
        { icon: 'hand-left', text: 'Tap a thought to reword it.' },
        { icon: 'finger-print', text: 'Hold a thought, then let go: turn it into a task or a habit, copy it, or delete it.' },
        { icon: 'reorder-three', text: 'Hold and drag to move it.' },
        { icon: 'arrow-back', text: 'Swipe left to delete, with a moment to undo.' },
        { icon: 'checkmark-done', text: 'Drag two fingers down the list to select several; tap to add or take one out. Hold a selected one to act on them all.' },
        ...(clearsOn ? [{ icon: 'moon', text: `It clears every ${clearsOn} night, so the week starts empty.` }] : []),
        { icon: 'lock-closed', text: 'It stays on this phone.' },
    ];
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Brain dump"
            footer={onExport ? <View style={styles.foot}><AppButton label="Export everything" icon="share-outline" onPress={onExport} /></View> : undefined}>
            <View style={styles.body}>
                {lines.map(line => (
                    <View key={line.text} style={styles.line}>
                        <AppIcon name={line.icon as never} size={Spacing.lg + Spacing.xs / 2} color={t.color.accentText} />
                        <Text variant="body" grow>{line.text}</Text>
                    </View>
                ))}
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { paddingHorizontal: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.sm },
    line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    foot: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
