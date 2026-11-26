import React from 'react';
import { Pressable, StyleSheet, Text, type AccessibilityRole, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { MatteSurface } from './MatteSurface';

/**
 * One choice among several: a matte pill, filled solid in `color` (the habit's
 * or habit's own colour, or the accent) once chosen, with a filled icon. Every
 * chip row in the app uses this, so a choice looks the same everywhere.
 */
/** How far a fitted pill's words may shrink: 15 pt to about 11. */
const FIT_SCALE = 0.75;

export function ChoicePill({ label, icon, on, color, onPress, radius = 999, style, pressStyle, textStyle, disabled, role = 'radio', accessibilityLabel, accessibilityHint, lines = 1, fit = false }: {
    /** In a row of equal pills: the words shrink a little (never under 11 pt) rather than cut off. */
    fit?: boolean;
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
    /** How many lines the label may take: one for a chip, more for an answer that is a sentence. */
    lines?: number;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme] ?? Colors.abyss;
    const ink = on ? textOn(color) : disabled ? colors.textTertiary : colors.textSecondary;
    return (
        <Pressable hitSlop={6} accessibilityRole={role} accessibilityState={role === 'checkbox' ? { checked: on, disabled } : { selected: on, disabled }}
            accessibilityLabel={accessibilityLabel ?? label} accessibilityHint={accessibilityHint}
            disabled={disabled} onPress={onPress} style={[styles.press, pressStyle]}>
            <MatteSurface radius={radius} level="control" elevation="none" tint={on ? color : undefined} style={[styles.pill, style]}>
                {icon ? <AppIcon filled={on} name={icon} size={14} color={ink} /> : null}
                <Text numberOfLines={lines} adjustsFontSizeToFit={fit} minimumFontScale={fit ? FIT_SCALE : undefined} style={[styles.text, { color: ink }, textStyle]}>{label}</Text>
            </MatteSurface>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    press: { maxWidth: '100%' },
    pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, maxWidth: '100%' },
    // Shrinks (with an ellipsis) before the pill outgrows where it sits.
    text: { fontSize: 13, fontFamily: FontFamily.medium, flexShrink: 1 },
});
