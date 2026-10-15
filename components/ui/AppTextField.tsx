import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { Control, Radius, Spacing, Typography } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';

interface AppTextFieldProps extends TextInputProps {
    label: string;
    leadingIcon?: keyof typeof Ionicons.glyphMap;
    trailingIcon?: keyof typeof Ionicons.glyphMap;
    onTrailingPress?: () => void;
    trailingAccessibilityLabel?: string;
    error?: string;
}

/** A labelled field: the one field look (MatteSurface) with a label, icons and an error line. */
export const AppTextField: React.FC<AppTextFieldProps> = ({
    label, leadingIcon, trailingIcon, onTrailingPress, trailingAccessibilityLabel,
    error, style, onFocus, onBlur, multiline, editable = true, ...inputProps
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [focused, setFocused] = useState(false);

    return (
        <View style={styles.group}>
            <Text style={[Typography.label, { color: colors.textSecondary }]}>{label}</Text>
            <MatteSurface
                radius={Radius.control}
                level="control"
                edge={error ? colors.error : undefined}
                style={[styles.inputShell, multiline && styles.multilineShell, !editable && styles.disabled]}
            >
                {leadingIcon ? <Ionicons name={leadingIcon} size={Control.icon} color={focused ? colors.textSecondary : colors.textTertiary} /> : null}
                <TextInput
                    accessibilityLabel={label}
                    placeholderTextColor={colors.textTertiary}
                    selectionColor={colors.textPrimary}
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
            </MatteSurface>
            {error ? <Text accessibilityLiveRegion="polite" style={[Typography.bodySmall, { color: colors.error }]}>{error}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    group: { gap: Spacing.sm },
    inputShell: { minHeight: Control.height, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    input: { ...Typography.body, flex: 1, minHeight: Control.height - 2, paddingVertical: Spacing.md },
    multilineShell: { alignItems: 'flex-start' },
    multiline: { minHeight: 120, textAlignVertical: 'top' },
    trailing: { width: Control.hitTarget, minHeight: Control.hitTarget, alignItems: 'center', justifyContent: 'center', marginRight: -Spacing.sm },
    disabled: { opacity: 0.5 },
});
