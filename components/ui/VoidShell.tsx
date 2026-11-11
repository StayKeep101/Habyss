import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { Colors } from '@/theme/colors';
import { surfaceFor } from '@/theme/designSystem';

interface VoidShellProps {
    children: React.ReactNode;
    /**
     * 'sheet': every page other than the four tabs (Home, Roadmap, Community,
     * Settings) — the card's own material, lit at the top and falling into the
     * page colour, exactly as the pop-up sheets (Missed, Wallet) are drawn
     * (VoidModal). 'tab': the accent's wash over the top third.
     */
    look?: 'tab' | 'sheet';
}

export const VoidShell: React.FC<VoidShellProps> = ({ children, look = 'tab' }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const tone = surfaceFor(theme);

    if (look === 'sheet') {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
                <LinearGradient pointerEvents="none" colors={[tone.top, tone.fill, colors.background]} locations={[0, 0.18, 0.5]}
                    style={StyleSheet.absoluteFill} />
                <View style={styles.content}>{children}</View>
            </View>
        );
    }

    /**
     * One gradient, not four.
     *
     * This used to stack a base colour, a three-stop gradient, a blue glow and
     * a perpetually breathing mist — four translucent layers of almost the same
     * dark colour. On a real screen that is where banding comes from: each
     * layer rounds to the nearest displayable value and the seams show as grey
     * steps. It also animated forever for something nobody consciously sees.
     *
     * What is left is the background colour and a single wash of the accent
     * over the top third, fading to nothing. Same feeling of depth, no seams,
     * and the colour follows whatever accent the user picked rather than being
     * hard-coded blue.
     */
    const wash = theme === 'light'
        ? [primary + '14', primary + '08', 'transparent'] as const
        : [primary + '1f', primary + '0d', 'transparent'] as const;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />

            <LinearGradient
                pointerEvents="none"
                colors={wash}
                locations={[0, 0.55, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.wash}
            />

            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    // Only the top third is touched; the rest is the background colour itself.
    wash: { position: 'absolute', top: 0, left: 0, right: 0, height: '34%' },
    content: { flex: 1 },
});
