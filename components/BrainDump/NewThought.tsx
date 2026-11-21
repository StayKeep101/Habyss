import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The circle's size, the same as a thought's. */
const TICK = 18;

/**
 * Where the next thought goes: the space under the last one. Tapped, it
 * becomes a line to write on, in the list itself, like Reminders: a circle,
 * the words, and on the right the send arrow or the mic. Return saves it and
 * leaves the line ready for the next; return on an empty line closes it.
 */
export function NewThought({ open, onOpen, value, onChange, onSubmit, onClose, inputRef, trailing, placeholder, empty }: {
    open: boolean;
    onOpen: () => void;
    value: string;
    onChange: (text: string) => void;
    onSubmit: () => void;
    onClose: () => void;
    inputRef: React.Ref<React.ElementRef<typeof MatteInput>>;
    /** The send arrow or the mic. */
    trailing?: React.ReactNode;
    placeholder: string;
    /** Nothing written yet: the space says what it is for. */
    empty?: boolean;
}) {
    const t = useTokens();
    if (!open) {
        return (
            <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="New thought" style={styles.space}>
                {empty ? <Text style={[styles.text, { color: t.color.textSubtle }]}>Tap to write what’s on your mind</Text> : null}
            </Pressable>
        );
    }
    return (
        <View style={styles.row}>
            <View style={[styles.tick, { borderColor: t.color.textSubtle }]} />
            <MatteInput
                bare
                ref={inputRef}
                autoFocus
                multiline
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor={t.color.textSubtle}
                returnKeyType="send"
                submitBehavior="submit"
                onSubmitEditing={() => (value.trim() ? onSubmit() : onClose())}
                onBlur={() => { if (!value.trim()) onClose(); }}
                selectionColor={t.color.accent}
                style={[styles.text, styles.input, { color: t.color.textPrimary }]}
                accessibilityLabel="New thought"
            />
            {trailing}
        </View>
    );
}

const styles = StyleSheet.create({
    /** Tall enough to find with a thumb, and the rest of the page under it. */
    space: { minHeight: Spacing.section * 5, paddingTop: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm + 2, paddingVertical: Spacing.sm + 3 },
    tick: { width: TICK, height: TICK, borderRadius: TICK / 2, borderWidth: 1.5, marginTop: 1.5, borderStyle: 'dashed' },
    text: { flex: 1, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21 },
    input: { padding: 0, maxHeight: 160 },
});
