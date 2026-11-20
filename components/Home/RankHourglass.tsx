import React from 'react';
import { Image } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Hourglass } from './Hourglass';
import { glassDesign } from '@/theme/hourglassDesigns';
import { HOURGLASS_ART, HOURGLASS_ART_RATIO } from '@/theme/hourglassArt';

/**
 * A rank, shown as its hourglass: the one picture a rank has. Its finished art
 * (theme/hourglassArt.ts) when it has some, otherwise drawn from its design
 * (theme/hourglassDesigns.ts), still, with some sand in each bulb. `size` is its height.
 */
export function RankHourglass({ rank, size }: { rank: string; size: number }) {
    const sand = useSharedValue(0.35);
    const art = HOURGLASS_ART[rank];
    if (art) {
        return <Image source={art} resizeMode="contain" accessibilityIgnoresInvertColors
            accessibilityLabel={`${rank} hourglass`} style={{ height: size, width: size * HOURGLASS_ART_RATIO }} />;
    }
    return <Hourglass design={glassDesign(rank)} size={size} ran={sand} running={false} />;
}
