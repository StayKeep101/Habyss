import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from './VoidSheet';
import { MatteInput } from './MatteInput';
import { AppButton } from './AppButton';
import { AppIcon } from './AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { FontFamily, Spacing } from '@/theme/designSystem';

export interface Choice { label: string; icon?: string; destructive?: boolean; onPress: () => void }

/**
 * The app's own way to offer a few choices (and, with `ask`, to ask for a
 * name), in its own sheet, instead of the system's action sheet or prompt.
 * A choice closes the sheet, then runs.
 */
export function ChoiceSheet({ visible, title, caption, choices = [], ask, onClose }: {
    visible: boolean;
    title: string;
    caption?: string;
    choices?: Choice[];
    /** Asks for a short piece of text instead: a field and a Save button. */
    ask?: { placeholder: string; initial?: string; save: string; onSave: (text: string) => void };
    onClose: () => void;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [text, setText] = useState(ask?.initial ?? '');
    const [lastAsk, setLastAsk] = useState(ask);
    if (ask !== lastAsk) { setLastAsk(ask); setText(ask?.initial ?? ''); }
    const pick = (choice: Choice) => { selectionFeedback(); onClose(); setTimeout(choice.onPress, 220); };
    const save = () => { const value = text.trim(); if (!value || !ask) return; selectionFeedback(); onClose(); ask.onSave(value); };
    return (
        // Asking: the field and its button sit in a list that lets a tap through
        // while the keyboard is up, so one tap on the button saves (it took two:
        // the first only put the keyboard away).
        <VoidSheet visible={visible} onClose={onClose} title={title} caption={caption} scrollable={!!ask}>
            {ask ? (
                <View style={styles.ask}>
                    <MatteInput value={text} onChangeText={setText} placeholder={ask.placeholder} autoFocus returnKeyType="done"
                        onSubmitEditing={save} textContentType="none" autoComplete="off" accessibilityLabel={ask.placeholder} />
                    <AppButton label={ask.save} disabled={!text.trim()} onPress={save} />
                </View>
            ) : (
                <View style={styles.list}>
                    {choices.map(choice => (
                        <Pressable key={choice.label} onPress={() => pick(choice)} style={styles.row} accessibilityRole="button" accessibilityLabel={choice.label}>
                            {choice.icon ? <AppIcon name={choice.icon} size={20} color={choice.destructive ? t.color.danger : t.color.textMuted} /> : null}
                            <Text style={[styles.label, { color: choice.destructive ? t.color.danger : t.color.textPrimary }]}>{choice.label}</Text>
                        </Pressable>
                    ))}
                </View>
            )}
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 52, paddingHorizontal: Spacing.xs },
    label: { fontSize: 17, fontFamily: FontFamily.medium },
    ask: { gap: Spacing.md, paddingBottom: Spacing.sm },
});
