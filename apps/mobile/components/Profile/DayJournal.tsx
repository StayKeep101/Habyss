import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, IconTile, Text, VoidCard } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { Spacing } from '@/theme/designSystem';

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
    rowText: { flex: 1, gap: Spacing.xs / 2 },
});

/** Your journal, as one row on your profile: › opens its calendar (app/(root)/journal.tsx). */
export function JournalRow({ onOpen }: { onOpen: () => void }) {
    const t = useTokens();
    return (
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Journal. Every day you posted, with your notes">
            <VoidCard style={styles.row}>
                <IconTile icon="book" color={t.color.accent} size={Spacing.xxl + Spacing.sm} />
                <View style={styles.rowText}>
                    <Text variant="heading">Journal</Text>
                    <Text variant="caption" tone="muted">Every day you posted, with your notes</Text>
                </View>
                <AppIcon name="chevron-forward" size={Spacing.lg} color={t.color.textSubtle} />
            </VoidCard>
        </Pressable>
    );
}
