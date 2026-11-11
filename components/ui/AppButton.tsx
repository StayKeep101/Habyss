import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { Control, Elevation, Radius, Spacing, Typography } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccentGradient } from '@/context/AccentContext';

/** The one button; `primary` for the one thing a page is for, `danger` for destructive words, `ghost` for words alone. */
type AppButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';

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
 * The one button. Matte, like every surface in the app. `primary` is the one
 * exception, for the single action a page is for: solid in the accent's
 * gradient with white words, drawn as HoldButton draws it. `ghost` is just the
 * words; `danger` is matte with red words.
 */
export const AppButton: React.FC<AppButtonProps> = ({
    label, onPress, variant = 'default', icon, disabled = false, loading = false,
    style, fullWidth = true, accessibilityLabel,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme] ?? Colors.abyss;
    const { buttonColors } = useAccentGradient();
    const foreground = variant === 'danger' ? colors.error : variant === 'primary' ? Colors.common.white : colors.textPrimary;
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
                : variant === 'primary'
                ? (
                    <View style={[styles.button, styles.primary]}>
                        <LinearGradient colors={buttonColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                        {inner}
                    </View>
                )
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
    primary: { borderRadius: Radius.control, overflow: 'hidden', ...Elevation.control },
    disabled: { opacity: 0.5 },
});
