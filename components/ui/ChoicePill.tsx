import React from 'react';
import { Pressable, StyleSheet, Text, type AccessibilityRole, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { MatteSurface } from './MatteSurface';

/**
 * One choice among several: a matte pill, filled solid in `color` (the goal's
 * or habit's own colour, or the accent) once chosen, with a filled icon. Every
 * chip row in the app uses this, so a choice looks the same everywhere.
 */
export function ChoicePill({ label, icon, on, color, onPress, radius = 999, style, pressStyle, textStyle, disabled, role = 'radio', accessibilityLabel, accessibilityHint }: {
    label: string;
    icon?: string;
    on: boolean;
    color: string;
    onPress: () => void;
    radius?: number;
    /** The pill's own size and padding. */
    style?: StyleProp<ViewStyle>;
    /** Where the pill sits in its row (flex, width). */
    pressStyle?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    disabled?: boolean;
    role?: AccessibilityRole;
    accessibilityLabel?: string;
    accessibilityHint?: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme] ?? Colors.abyss;
    const ink = on ? textOn(color) : disabled ? colors.textTertiary : colors.textSecondary;
    return (
        <Pressable accessibilityRole={role} accessibilityState={role === 'checkbox' ? { checked: on, disabled } : { selected: on, disabled }}
            accessibilityLabel={accessibilityLabel ?? label} accessibilityHint={accessibilityHint}
            disabled={disabled} onPress={onPress} style={pressStyle}>
            <MatteSurface radius={radius} level="control" elevation="none" tint={on ? color : undefined} style={[styles.pill, style]}>
                {icon ? <AppIcon filled={on} name={icon} size={14} color={ink} /> : null}
                <Text numberOfLines={1} style={[styles.text, { color: ink }, textStyle]}>{label}</Text>
            </MatteSurface>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
    text: { fontSize: 13, fontFamily: FontFamily.medium },
});
