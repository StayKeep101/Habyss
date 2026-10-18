import React from 'react';
import { Keyboard, Pressable, StyleSheet } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/theme/colors';
import { readableAccent } from '@/lib/colorContrast';
import { useHaptics } from '@/hooks/useHaptics';

/**
 * The habit's or goal's look, beside its name: its icon in its colour. Tap
 * it to change either (the Look panel opens, the keyboard steps aside).
 */
export function LookButton({ icon, color, open, onPress }: { icon: IconName; color: string; open: boolean; onPress: () => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const tint = readableAccent(color, colors.background);
    return (
        <Pressable accessibilityRole="button" accessibilityLabel="Change the look" accessibilityState={{ expanded: open }}
            onPress={() => { selectionFeedback(); Keyboard.dismiss(); onPress(); }} hitSlop={6}>
            <MatteSurface radius={14} level="control" tint={open ? color : undefined} style={styles.disc}>
                <AppIcon filled name={icon} size={22} color={open ? '#FFFFFF' : tint} />
            </MatteSurface>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    disc: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
