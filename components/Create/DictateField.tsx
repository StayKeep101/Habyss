import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MicButton } from '@/components/ui/MicButton';
import { Spacing } from '@/theme/designSystem';
import { useDictation } from '@/hooks/useDictation';
import { tidySpeech } from '@/lib/voiceClean';

/**
 * A text field you can also talk into: the mic sits in its corner, and what
 * is said is added to what is already typed, live, as it is heard. Used by
 * every place something is written — habit, task, goal, brain dump.
 */
export function DictateField({ text, onText, children, leading }: {
    text: string; onText: (value: string) => void; children: React.ReactNode;
    /** Beside the field on the left, e.g. the habit's look. */
    leading?: React.ReactNode;
}) {
    const base = useRef('');
    const join = (heard: string) => `${base.current}${base.current && heard ? ' ' : ''}${heard}`;
    // Live while talking; tidied once finished (fillers out, a ramble condensed).
    const dictation = useDictation(heard => onText(join(heard)), heard => { void tidySpeech(heard).then(clean => onText(join(clean))); });
    return (
        <View style={leading ? styles.row : undefined}>
            {leading ? <View style={styles.leading}>{leading}</View> : null}
            <View style={leading ? styles.flex : undefined}>
            {children}
            {dictation.available ? (
                <View style={styles.mic}>
                    <MicButton size={32} listening={dictation.listening} onPress={() => { base.current = text.trim(); void dictation.toggle(); }} />
                </View>
            ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    mic: { position: 'absolute', right: Spacing.sm, bottom: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    leading: { paddingTop: Spacing.sm },
    flex: { flex: 1 },
});
