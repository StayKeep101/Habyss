import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { Control, Radius, Spacing, Typography } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';

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

/**
 * The one button. Matte, like every surface in the app — no accent fill, no
 * gradient. `primary` and `secondary` are the same matte button; `ghost` is
 * just the words; `danger` is matte with red words.
 */
export const AppButton: React.FC<AppButtonProps> = ({
    label, onPress, variant = 'primary', icon, disabled = false, loading = false,
    style, fullWidth = true, accessibilityLabel,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme] ?? Colors.abyss;
    const foreground = variant === 'danger' ? colors.error : colors.textPrimary;
    const inner = (
        <>
            {loading ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Ionicons filled name={icon} size={Control.icon} color={foreground} /> : null}
            <Text style={[Typography.button, styles.label, { color: foreground }]}>{label}</Text>
        </>
    );
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            disabled={disabled || loading}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: disabled || loading, busy: loading }}
            style={[fullWidth && styles.fullWidth, style, (disabled || loading) && styles.disabled]}
        >
            {variant === 'ghost'
                ? <ViewRow>{inner}</ViewRow>
                : <MatteSurface radius={Radius.control} level="control" style={styles.button}>{inner}</MatteSurface>}
        </TouchableOpacity>
    );
};

/** The words alone, laid out like a button. */
const ViewRow = ({ children }: { children: React.ReactNode }) => <View style={styles.button}>{children}</View>;

const styles = StyleSheet.create({
    fullWidth: { width: '100%' },
    button: {
        minHeight: Control.height, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    label: { flexShrink: 1, textAlign: 'center' },
    disabled: { opacity: 0.5 },
});
