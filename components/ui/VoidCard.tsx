import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { Radius, elevationFor, surfaceFor } from '@/theme/designSystem';

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
 * A dark, opaque body with a soft gradient — lighter at the top where light
 * falls, darker towards the bottom — one faint hairline of light along the
 * edge, large corners, and a soft shadow underneath that lifts it off the
 * page. No blur and no gloss. One card for the whole app; change it here and
 * every screen follows.
 *
 * Two layers, because a shadow and clipped corners cannot live on the same
 * view on iOS: the card itself carries the shadow and the edge, and the
 * gradient sits behind the contents in its own clipped layer.
 */
export const VoidCard: React.FC<VoidCardProps> = ({ children, style }) => {
    const { theme } = useTheme();
    const tone = surfaceFor(theme);
    return (
        <View style={[styles.card, elevationFor(theme, 'card'), { backgroundColor: tone.fill, borderColor: tone.lip }, style]}>
            <View pointerEvents="none" style={styles.fill}>
                <LinearGradient colors={[tone.top, tone.fill, tone.bottom]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
            </View>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: Radius.card,
        borderWidth: 1,
    },
    fill: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: Radius.card - 1,
        overflow: 'hidden',
    },
});
