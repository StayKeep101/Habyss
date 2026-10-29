import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTokens } from '@/hooks/useTokens';

/**
 * The crown of King of the Week, drawn (the icon set has none): beside the
 * name of whoever holds it, in the warm gold of the streak flame.
 */
export function Crown({ size = 16, color }: { size?: number; color?: string }) {
    const t = useTokens();
    const ink = color ?? t.color.warning;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Holds the crown" accessibilityRole="image">
            <Path d="M3 17.5h18L19.4 7.8l-4.6 4.1L12 4.5l-2.8 7.4-4.6-4.1L3 17.5z" fill={ink} />
            <Path d="M4 19.5h16v2H4z" fill={ink} />
        </Svg>
    );
}
