import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { Elevation, elevationFor, surfaceFor } from '@/theme/designSystem';

/**
 * The one matte surface every piece of the app is made of, the way Phantom
 * draws its: an opaque body with a soft gradient (lighter at the top, where
 * light falls), one faint hairline of light along the edge, and a shadow
 * underneath that lifts it off whatever it sits on.
 *
 * Cards, the tab bar, icon buttons, text fields and chips all use it, in
 * their own shape: give it a `radius` (half the height for a circle or pill).
 *
 * `level` picks the body: `card` for panels on the page, `control` for things
 * you press or type into, a step lighter so they still read on top of a card.
 * `tint` lays a colour over the body — a chosen chip in the accent.
 *
 * Two layers, because iOS cannot clip and cast a shadow on the same view: the
 * outer view carries the shadow and the edge, and the gradient sits behind the
 * contents in its own clipped layer.
 */
export function MatteSurface({
    children, style, radius, level = 'card', elevation, tint, edge, pointerEvents,
}: {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    radius: number;
    level?: 'card' | 'control';
    elevation?: keyof typeof Elevation | 'none';
    tint?: string;
    /** The edge colour, when it has to say something (focus, an error). */
    edge?: string;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}) {
    const { theme } = useTheme();
    const tone = surfaceFor(theme);
    const light = theme === 'light';
    const lift = elevation ?? (level === 'card' ? 'card' : 'control');
    const body = level === 'card' ? tone.fill : tone.raised;
    const gradient: [string, string, string] = level === 'card'
        ? [tone.top, tone.fill, tone.bottom]
        // A control is the raised tone, lit from the top and falling off below.
        : light
            ? ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)', 'rgba(15,23,42,0.04)']
            : ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.22)'];
    return (
        <View
            pointerEvents={pointerEvents}
            style={[
                { borderRadius: radius, borderWidth: 1, backgroundColor: body, borderColor: edge ?? tone.lip },
                lift === 'none' ? null : elevationFor(theme, lift),
                style,
            ]}
        >
            <View pointerEvents="none" style={[styles.layer, { borderRadius: Math.max(0, radius - 1) }]}>
                <LinearGradient colors={gradient} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
                {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
