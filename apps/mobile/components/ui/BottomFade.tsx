import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/theme/colors';

/**
 * The fade the page sinks into at the bottom of the screen, behind anything
 * floating there (the tab bar, a page's view switcher): content dims as it
 * scrolls underneath instead of meeting a hard line, the way Phantom does.
 */
export function BottomFade({ height }: { height: number }) {
    const { theme } = useTheme();
    const background = (Colors[theme] ?? Colors.abyss).background;
    return (
        <LinearGradient
            pointerEvents="none"
            colors={[background + '00', background + 'B3', background + 'F2']}
            locations={[0, 0.45, 1]}
            style={[styles.fade, { height }]}
        />
    );
}

const styles = StyleSheet.create({
    fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
