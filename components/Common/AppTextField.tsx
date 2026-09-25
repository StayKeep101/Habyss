import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { Control, Radius, Spacing, Typography } from '@/constants/DesignSystem';

interface AppTextFieldProps extends TextInputProps {
    label: string;
    leadingIcon?: keyof typeof Ionicons.glyphMap;
    trailingIcon?: keyof typeof Ionicons.glyphMap;
    onTrailingPress?: () => void;
    trailingAccessibilityLabel?: string;
    error?: string;
}

export const AppTextField: React.FC<AppTextFieldProps> = ({
    label, leadingIcon, trailingIcon, onTrailingPress, trailingAccessibilityLabel,
    error, style, onFocus, onBlur, multiline, editable = true, ...inputProps
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { foreground } = useAccentGradient();
    const [focused, setFocused] = useState(false);

    return (
        <View style={styles.group}>
            <Text style={[Typography.label, { color: colors.textSecondary }]}>{label}</Text>
            <View style={[
                styles.inputShell, multiline && styles.multilineShell,
                { backgroundColor: colors.surfaceSecondary, borderColor: error ? colors.error : focused ? foreground : colors.border },
                !editable && styles.disabled,
            ]}>
                {leadingIcon ? <Ionicons name={leadingIcon} size={Control.icon} color={focused ? foreground : colors.textTertiary} /> : null}
                <TextInput
                    accessibilityLabel={label}
                    placeholderTextColor={colors.textTertiary}
                    selectionColor={foreground}
                    {...inputProps}
                    editable={editable}
                    multiline={multiline}
                    onFocus={event => { setFocused(true); onFocus?.(event); }}
                    onBlur={event => { setFocused(false); onBlur?.(event); }}
                    style={[styles.input, { color: colors.textPrimary }, multiline && styles.multiline, style]}
                />
                {trailingIcon ? onTrailingPress ? (
                    <TouchableOpacity onPress={onTrailingPress} disabled={!editable} accessibilityRole="button"
                        accessibilityLabel={trailingAccessibilityLabel ?? label + ' options'} style={styles.trailing}>
                        <Ionicons name={trailingIcon} size={Control.icon} color={colors.textSecondary} />
                    </TouchableOpacity>
                ) : <Ionicons name={trailingIcon} size={Control.icon} color={colors.textTertiary} /> : null}
            </View>
            {error ? <Text accessibilityLiveRegion="polite" style={[Typography.bodySmall, { color: colors.error }]}>{error}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    group: { gap: Spacing.sm },
    inputShell: { minHeight: Control.height, borderRadius: Radius.control, borderWidth: 1, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    input: { ...Typography.body, flex: 1, minHeight: Control.height - 2, paddingVertical: Spacing.md },
    multilineShell: { alignItems: 'flex-start' },
    multiline: { minHeight: 120, textAlignVertical: 'top' },
    trailing: { width: Control.hitTarget, minHeight: Control.hitTarget, alignItems: 'center', justifyContent: 'center', marginRight: -Spacing.sm },
    disabled: { opacity: 0.5 },
});
