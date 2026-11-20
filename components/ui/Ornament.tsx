import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/theme/colors';
import { Spacing } from '@/theme/designSystem';

/**
 * "—— ✦ ——": the mark on the base of every rank's hourglass, used as a
 * divider near it so the page and the glass speak the same language. Two
 * lines that fade in towards a small four-point star, all in `color` (the
 * rank's). Decoration only: hidden from VoiceOver.
 */
export function Ornament({ color, width = '60%' }: { color: string; width?: `${number}%` | number }) {
    return (
        <View style={[styles.row, { width }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
            <LinearGradient colors={[Colors.common.transparent, color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
            <Svg width={STAR} height={STAR} viewBox="0 0 24 24">
                <Path d="M12 0 C12.8 7 17 11.2 24 12 C17 12.8 12.8 17 12 24 C11.2 17 7 12.8 0 12 C7 11.2 11.2 7 12 0 Z" fill={color} />
            </Svg>
            <LinearGradient colors={[color, Colors.common.transparent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
        </View>
    );
}

const STAR = Spacing.md;

const styles = StyleSheet.create({
    row: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    line: { flex: 1, height: StyleSheet.hairlineWidth * 3, borderRadius: 999, opacity: 0.8 },
});
