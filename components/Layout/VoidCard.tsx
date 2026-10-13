import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { BlurView } from 'expo-blur';
import { Radius, elevationFor, surfaceFor } from '@/theme/designSystem';

interface VoidCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    glass?: boolean;
    intensity?: number;
    /**
     * A solid card that sits above the page: matte fill, a soft shadow under
     * it, and a single lit hairline along the top rather than an outline around
     * everything.
     *
     * This is what a card should be, and the rest of this component is what
     * they were — kept because half the app is still drawn that way, and
     * changing every screen at once is how a redesign becomes a regression.
     */
    matte?: boolean;
}

export const VoidCard: React.FC<VoidCardProps> = ({ children, style, glass = false, intensity = 20, matte = false }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';

    if (matte) {
        const tone = surfaceFor(theme);
        return (
            <View style={[styles.matte, elevationFor(theme), {
                backgroundColor: tone.fill,
                borderColor: tone.lip,
            }, style]}>
                {children}
            </View>
        );
    }

    const containerStyle = [
        styles.card,
        {
            backgroundColor: glass
                ? isLight
                    ? 'rgba(255,255,255,0.84)'
                    : isTrueDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'transparent'
                : isLight
                    ? colors.surface
                    : colors.surfaceSecondary,
            borderColor: colors.border,
        },
        isLight && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.06,
            shadowRadius: 20,
            elevation: 3,
        },
        style,
    ];

    if (glass && !isLight && !isTrueDark) {
        return (
            <BlurView intensity={intensity} tint="dark" style={containerStyle}>
                {children}
            </BlurView>
        );
    }

    return (
        <View style={containerStyle}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: Radius.card,
        borderWidth: 1,
        overflow: 'hidden',
    },
    matte: {
        borderRadius: Radius.card,
        // A hairline of white, not of the accent — the same edge a real surface
        // catches light along. What made the old cards look like wireframes was
        // having nothing behind that line; with a matte fill and a shadow under
        // it, the same hairline reads as an edge instead of an outline.
        borderWidth: StyleSheet.hairlineWidth,
        // Deliberately not clipped: on iOS `overflow: hidden` sets
        // masksToBounds, which throws the shadow away along with the corners.
        // Nothing inside these cards paints to the edge.
    },
});
