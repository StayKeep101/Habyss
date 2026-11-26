import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { AppButton } from '@/components/ui/AppButton';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useRetained } from '@/hooks/useRetained';
import { splitThought, type ThoughtKind, type ThoughtPiece } from '@/lib/thoughtSplit';

const KINDS: { id: ThoughtKind; label: string }[] = [
    { id: 'task', label: 'Task' }, { id: 'habit', label: 'Habit' }, { id: 'note', label: 'Keep' },
];

/**
 * One thought, sorted: the things in it, each with a suggested kind you can
 * change (Task, Habit, or Keep as a note), and nothing made until you
 * press Create. "Saturday: clean the apartment, wash clothes, buy groceries"
 * is three tasks for Saturday; "What if…?" is an idea to keep.
 */
export function SortThoughtSheet({ text: asked, onClose, onCreate }: {
    text: string | null;
    onClose: () => void;
    onCreate: (pieces: ThoughtPiece[]) => void;
}) {
    const t = useTokens();
    // Kept while it slides away, so closing is as smooth as opening.
    const text = useRetained(asked);
    const [pieces, setPieces] = useState<ThoughtPiece[]>([]);
    useEffect(() => { if (asked) setPieces(splitThought(asked)); }, [asked]);
    if (!text) return null;
    const making = pieces.filter(piece => piece.kind !== 'note').length;
    const set = (index: number, kind: ThoughtKind) => setPieces(list => list.map((piece, at) => (at === index ? { ...piece, kind } : piece)));

    return (
        <VoidSheet visible={!!asked} onClose={onClose} title={pieces.length > 1 ? `${pieces.length} things in this` : 'Sort it out'} maxShare={0.85}
            footer={
                <View style={styles.footer}>
                    <AppButton label={making ? `Create ${making}` : 'Keep as a note'} onPress={() => onCreate(pieces)} />
                </View>
            }>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                {pieces.map((piece, index) => (
                    <MatteSurface key={`${index}:${piece.text}`} radius={16} style={styles.card}>
                        <Text style={[styles.text, { color: t.color.textPrimary }]}>{piece.text}</Text>
                        <ChoiceRow accessibilityLabel={`Make "${piece.text}" a`} value={piece.kind} onChange={kind => set(index, kind)} options={KINDS} />
                    </MatteSurface>
                ))}
            </ScrollView>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    scroll: { flexGrow: 0 },
    body: { gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    card: { padding: Spacing.md, gap: Spacing.sm },
    text: { fontSize: 15, fontFamily: FontFamily.medium },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
