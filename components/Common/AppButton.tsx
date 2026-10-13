import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { Control, Radius, Spacing, Typography } from '@/theme/designSystem';

type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface AppButtonProps {
    label: string;
    onPress: () => void;
    variant?: AppButtonVariant;
    icon?: keyof typeof Ionicons.glyphMap;
    disabled?: boolean;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
    fullWidth?: boolean;
    accessibilityLabel?: string;
}

export const AppButton: React.FC<AppButtonProps> = ({
    label, onPress, variant = 'primary', icon, disabled = false, loading = false,
    style, fullWidth = true, accessibilityLabel,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { buttonColors } = useAccentGradient();
    const foreground = variant === 'primary' ? Colors.common.white : variant === 'danger' ? colors.error : colors.textPrimary;
    const backgroundColor = variant === 'secondary' ? colors.surfaceSecondary : variant === 'danger' ? colors.error + '14' : 'transparent';

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            disabled={disabled || loading}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: disabled || loading, busy: loading }}
            style={[
                styles.button, fullWidth && styles.fullWidth,
                { backgroundColor, borderColor: variant === 'primary' ? 'transparent' : variant === 'danger' ? colors.error + '44' : colors.border },
                style, (disabled || loading) && styles.disabled,
            ]}
        >
            {variant === 'primary' && (
                <LinearGradient colors={buttonColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            )}
            {loading ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Ionicons name={icon} size={Control.icon} color={foreground} /> : null}
            <Text style={[Typography.button, styles.label, { color: foreground }]}>{label}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    fullWidth: { width: '100%' },
    button: {
        minHeight: Control.height, borderRadius: Radius.control, borderWidth: 1,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, overflow: 'hidden',
    },
    label: { flexShrink: 1, textAlign: 'center' },
    disabled: { opacity: 0.5 },
});
