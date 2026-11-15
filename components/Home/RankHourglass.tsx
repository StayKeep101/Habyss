import React from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { Hourglass } from './Hourglass';
import { glassDesign } from '@/theme/hourglassDesigns';

/**
 * A rank, shown as its hourglass (theme/hourglassDesigns.ts): the one picture a
 * rank has. Still, with some sand in each bulb. `size` is its height.
 */
export function RankHourglass({ rank, size }: { rank: string; size: number }) {
    const sand = useSharedValue(0.35);
    return <Hourglass design={glassDesign(rank)} size={size} ran={sand} running={false} />;
}
