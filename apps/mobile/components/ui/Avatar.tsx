import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/theme/colors';
import { FontFamily, surfaceFor } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';

/**
 * Someone's face: their photo, or their initial on a raised disc. An optional
 * ring (a status or a done state) and a badge that sits on the edge, outside
 * the circle, so the photo never clips it.
 */
export function Avatar({ name, uri, size = 44, ring, badge, style, dim }: {
    name: string;
    uri?: string | null;
    size?: number;
    /** A coloured ring around the face. */
    ring?: string;
    /** Drawn at the bottom-right edge. */
    badge?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    dim?: boolean;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { primary } = useAccentGradient();
    const ringWidth = ring ? Math.max(2, Math.round(size / 22)) : 0;
    return (
        <View style={[{ width: size, height: size, opacity: dim ? 0.6 : 1 }, style]}>
            <View style={[styles.face, {
                width: size, height: size, borderRadius: size / 2,
                backgroundColor: tone.raised, borderWidth: ringWidth, borderColor: ring ?? 'transparent',
            }]}>
                {uri
                    ? <Image source={{ uri }} style={styles.photo} />
                    : <Text style={[styles.initial, { color: primary, fontSize: size * 0.4 }]}>{name.trim().slice(0, 1).toUpperCase() || '?'}</Text>}
            </View>
            {badge ? <View style={[styles.badge, { right: -size * 0.04, bottom: -size * 0.04, borderColor: colors.background }]}>{badge}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    face: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%', resizeMode: 'cover' },
    initial: { fontFamily: FontFamily.bold },
    badge: { position: 'absolute', borderRadius: 999, borderWidth: 2 },
});
