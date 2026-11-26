import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton } from './AppButton';
import { AppTextField } from './AppTextField';
import { PopupCard } from './PopupCard';
import { useHaptics } from '@/hooks/useHaptics';
import { Spacing } from '@/theme/designSystem';

/**
 * A few words, asked in a pop-up: the card rises with the keyboard open, a
 * roomy box to write in, and two small choices under it (put it away, keep
 * it). Every "how did it go?" in the app is this one card (the day's note,
 * thoughts after a habit), so changing it here changes them all.
 */
export function NotePopup({ visible, onClose, icon, iconColor, title, body, value, onChangeText, placeholder, label, skipLabel = 'Skip', saveLabel = 'Keep it', onSave }: {
    visible: boolean;
    /** Tapped outside, or the skip choice. */
    onClose: () => void;
    icon: string;
    iconColor: string;
    title: string;
    body?: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    /** What VoiceOver calls the box. */
    label: string;
    skipLabel?: string;
    saveLabel?: string;
    onSave: () => void;
}) {
    const { successFeedback, lightFeedback } = useHaptics();
    return (
        <PopupCard visible={visible} onClose={onClose} icon={icon} iconColor={iconColor} typing title={title} body={body}>
            <AppTextField value={value} onChangeText={onChangeText} multiline autoFocus maxLength={600} style={styles.field}
                placeholder={placeholder} accessibilityLabel={label} />
            <View style={styles.actions}>
                <AppButton label={skipLabel} variant="ghost" compact fullWidth={false} onPress={() => { lightFeedback(); onClose(); }} />
                <AppButton label={saveLabel} icon="checkmark" variant="primary" compact fullWidth={false} disabled={!value.trim()}
                    onPress={() => { successFeedback(); onSave(); }} />
            </View>
        </PopupCard>
    );
}

const styles = StyleSheet.create({
    // Room to write: four lines or so, and the card still clears the status bar over the keyboard.
    field: { minHeight: Spacing.section * 3.5, textAlignVertical: 'top' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
});
