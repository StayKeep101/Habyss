import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@/theme/colors';

/**
 * The hourglass's own light, so it sits in Home rather than on it: a soft
 * halo of the rank's colour behind the glass, a pool of that light on the
 * panel where it stands, and the small dark shadow under its base. Still, and
 * the same for every rank (only the colour changes), so every hourglass,
 * wood or crystal, belongs. Drawn behind the glass; touches pass through.
 */
export function GlassLight({ color, size }: { color: string; size: number }) {
    const halo = size * 1.7;
    const poolWidth = size * 2.1;
    const poolHeight = size * 0.26;
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {/* Behind the glass: its glow into the night. */}
            <Svg width={halo} height={halo} style={[styles.centre, { marginLeft: -halo / 2, marginTop: -halo / 2 }]}>
                <Defs>
                    <RadialGradient id="glassHalo" cx="50%" cy="50%" r="50%">
                        <Stop offset="0" stopColor={color} stopOpacity={0.26} />
                        <Stop offset="0.55" stopColor={color} stopOpacity={0.08} />
                        <Stop offset="1" stopColor={color} stopOpacity={0} />
                    </RadialGradient>
                </Defs>
                <Ellipse cx={halo / 2} cy={halo / 2} rx={halo / 2} ry={halo / 2} fill="url(#glassHalo)" />
            </Svg>
            {/* Where it stands: its light spread on the panel, and the shadow right under it. */}
            <Svg width={poolWidth} height={poolHeight} style={[styles.base, { marginLeft: -poolWidth / 2, bottom: -poolHeight / 2 }]}>
                <Defs>
                    <RadialGradient id="glassPool" cx="50%" cy="50%" r="50%">
                        <Stop offset="0" stopColor={color} stopOpacity={0.3} />
                        <Stop offset="1" stopColor={color} stopOpacity={0} />
                    </RadialGradient>
                    <RadialGradient id="glassShadow" cx="50%" cy="50%" r="50%">
                        <Stop offset="0" stopColor={Colors.common.black} stopOpacity={0.55} />
                        <Stop offset="1" stopColor={Colors.common.black} stopOpacity={0} />
                    </RadialGradient>
                </Defs>
                <Ellipse cx={poolWidth / 2} cy={poolHeight / 2} rx={poolWidth / 2} ry={poolHeight / 2} fill="url(#glassPool)" />
                <Ellipse cx={poolWidth / 2} cy={poolHeight / 2} rx={size * 0.42} ry={poolHeight * 0.22} fill="url(#glassShadow)" />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    centre: { position: 'absolute', left: '50%', top: '50%' },
    base: { position: 'absolute', left: '50%' },
});
