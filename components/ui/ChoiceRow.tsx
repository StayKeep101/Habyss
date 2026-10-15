import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChoicePill } from './ChoicePill';
import { Spacing } from '@/theme/designSystem';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';

/**
 * A few choices side by side: the app's own choice pills, the chosen one filled
 * in the accent. It replaced the iOS segmented control (a grey track with a
 * sliding thumb), which was the one control in the app with a look of its own.
 */
export function ChoiceRow<T extends string | number>({ options, value, onChange, accessibilityLabel }: {
    options: { id: T; label: string }[];
    value: T;
    onChange: (id: T) => void;
    accessibilityLabel?: string;
}) {
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    return (
        <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.row}>
            {options.map(option => (
                <ChoicePill key={String(option.id)} label={option.label} on={option.id === value} color={primary}
                    pressStyle={styles.item}
                    onPress={() => { if (option.id !== value) { selectionFeedback(); onChange(option.id); } }} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.sm },
    item: { flex: 1 },
});
