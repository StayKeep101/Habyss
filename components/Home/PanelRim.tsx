import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/colors';
import { Radius } from '@/theme/designSystem';

/**
 * Home's panel catching the hourglass's light: its top edge lit in the rank's
 * colour where the glass stands, fading out to the corners, and the faintest
 * wash of that light falling onto the panel below. Still; touches pass through.
 */
export function PanelRim({ color }: { color: string }) {
    return (
        <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LinearGradient colors={[Colors.common.transparent, color, Colors.common.transparent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edge} />
            <LinearGradient colors={[`${color}1F`, `${color}00`]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.wash} />
        </View>
    );
}

const CORNER = Radius.sheet * 1.5;

const styles = StyleSheet.create({
    wrap: { position: 'absolute', top: 0, left: 0, right: 0, height: CORNER * 4 },
    edge: { marginHorizontal: CORNER, height: StyleSheet.hairlineWidth * 3, opacity: 0.9 },
    wash: { flex: 1, borderTopLeftRadius: CORNER, borderTopRightRadius: CORNER },
});
