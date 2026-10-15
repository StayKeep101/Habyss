import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Radius, surfaceFor } from '@/theme/designSystem';

interface VoidCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Kept so older screens still compile; every card is matte now. */
    glass?: boolean;
    /** Kept so older screens still compile; there is no blur any more. */
    intensity?: number;
    /** Kept so older screens still compile; every card is matte now. */
    matte?: boolean;
}

/**
 * The card: matte, the way Phantom draws them.
 *
 * A flat, opaque fill one step above the page, a single crisp hairline of
 * light along the edge, large soft corners — and nothing else. No blur, no
 * gloss, no glow, no shadow. One card style for the whole app; change it here
 * and every screen follows.
 */
export const VoidCard: React.FC<VoidCardProps> = ({ children, style }) => {
    const { theme } = useTheme();
    const tone = surfaceFor(theme);
    return (
        <View style={[styles.card, { backgroundColor: tone.fill, borderColor: tone.lip }, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: Radius.card,
        borderWidth: 1,
        // Clipped, so photos and fills inside follow the corners. There is no
        // shadow to lose by it.
        overflow: 'hidden',
    },
});
