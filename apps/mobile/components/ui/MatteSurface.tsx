import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { Elevation, elevationFor, surfaceFor } from '@/theme/designSystem';

/**
 * The one matte surface every piece of the app is made of, the way Phantom
 * draws its: an opaque body with a soft gradient (lighter at the top, where
 * light falls) and a shadow underneath that lifts it off whatever it sits on.
 * No outline: an edge appears only when it has something to say (a focused
 * field, a chosen chip).
 *
 * Cards, the tab bar, icon buttons, text fields and chips all use it, in
 * their own shape: give it a `radius` (half the height for a circle or pill).
 *
 * Shadows only on what floats over other things (the tab bar, a sticky bar,
 * a menu, a pop-up): pass `elevation="floating"`. Cards, chips and fields
 * sit flat on the page, so the gradient reads cleanly with no dark band
 * under it. `level` is kept for callers; it no longer adds a shadow.
 * `tint` lays a colour over the body — a chosen chip in the accent.
 *
 * Two layers, because iOS cannot clip and cast a shadow on the same view: the
 * outer view carries the shadow and the edge, and the gradient sits behind the
 * contents in its own clipped layer.
 */
export function MatteSurface({
    children, style, radius, level = 'card', elevation, tint, edge, hairline, pointerEvents,
}: {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    radius: number;
    level?: 'card' | 'control';
    elevation?: keyof typeof Elevation | 'none';
    tint?: string;
    /** The edge colour, when it has to say something (focus, an error). */
    edge?: string;
    /** A hairline edge instead of a full point, for an edge that should barely show. */
    hairline?: boolean;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}) {
    const { theme } = useTheme();
    const tone = surfaceFor(theme);
    void level;
    const lift = elevation ?? 'none';
    // One corner for every layer: a card given a sharper corner in its style
    // must not keep a rounder gradient inside it (two cards in one).
    const flat = StyleSheet.flatten(style);
    const corner = typeof flat?.borderRadius === 'number' ? flat.borderRadius : radius;
    // One body for everything: the card's own gradient. Buttons, fields, chips
    // and the tab bar are the card's material in another shape, so they match
    // it exactly; only the shadow under them changes with `level`.
    const body = tone.fill;
    const gradient: [string, string, string] = [tone.top, tone.fill, tone.bottom];
    return (
        <View
            pointerEvents={pointerEvents}
            style={[
                // No border at all unless one has something to say: even a transparent
                // one leaves a ring of the base colour around the gradient.
                { borderRadius: corner, borderWidth: edge ? (hairline ? StyleSheet.hairlineWidth : 1) : 0, backgroundColor: body, borderColor: edge },
                lift === 'none' ? null : elevationFor(theme, lift),
                style,
            ]}
        >
            <View pointerEvents="none" style={[styles.layer, { borderRadius: Math.max(0, corner - (edge ? (hairline ? StyleSheet.hairlineWidth : 1) : 0)) }]}>
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
