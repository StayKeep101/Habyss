import React, { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** Below this the facets blur into a blob, so it is never drawn smaller. */
const SMALLEST = 14;

/**
 * A Shard: Habyss's currency, drawn as its own faceted crystal (the "Apex"
 * shard). Used wherever Shards are counted, earned, bet or spent, in place of
 * a generic diamond glyph. Its colours are the artwork's own, like the rank
 * gems', so it reads as the same object on every screen and in every theme.
 *
 * Decorative by default (the number beside it says what it is); give it an
 * `accessibilityLabel` when it stands alone.
 */
export function ShardIcon({ size: asked = 16, accessibilityLabel }: { size?: number; accessibilityLabel?: string }) {
    const size = Math.max(SMALLEST, asked);
    // Unique per copy: two shards on one screen must not share gradient ids.
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const g = (name: string) => `${name}${id}`;
    return (
        <Svg width={size} height={size} viewBox="0 0 128 128"
            accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityLabel ? 'image' : undefined}>
            <Defs>
                <LinearGradient id={g('body')} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#D5E9FF" /><Stop offset="0.32" stopColor="#76B4FF" />
                    <Stop offset="0.70" stopColor="#3377E6" /><Stop offset="1" stopColor="#17366E" />
                </LinearGradient>
                <LinearGradient id={g('ice')} x1="0" y1="0" x2="0.8" y2="1">
                    <Stop offset="0" stopColor="#F3FAFF" /><Stop offset="0.56" stopColor="#A6D3FF" /><Stop offset="1" stopColor="#5B93E6" />
                </LinearGradient>
                <LinearGradient id={g('deep')} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#3869C6" /><Stop offset="1" stopColor="#132A55" />
                </LinearGradient>
                <LinearGradient id={g('mid')} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#83B8FF" /><Stop offset="1" stopColor="#326CD3" />
                </LinearGradient>
            </Defs>
            <Path d="M64 7 104 42 93 95 64 122 35 95 24 42Z" fill={`url(#${g('body')})`} />
            <Path d="M64 7 64 122 35 95 24 42Z" fill={`url(#${g('deep')})`} opacity={0.52} />
            <Path d="M64 7 24 42 64 52Z" fill={`url(#${g('ice')})`} />
            <Path d="M64 7 104 42 64 52Z" fill="#87C3FF" />
            <Path d="M24 42 64 52 35 95Z" fill="#4C8EF2" />
            <Path d="M104 42 64 52 93 95Z" fill={`url(#${g('mid')})`} />
            <Path d="M64 52 35 95 64 122Z" fill="#3159AD" />
            <Path d="M64 52 93 95 64 122Z" fill="#5C98ED" />
            <Path d="M64 7 64 122" stroke="#CEE8FF" strokeWidth={2} strokeOpacity={0.62} />
            <Path d="M24 42 64 52 104 42" stroke="#D6EDFF" strokeWidth={1.7} strokeOpacity={0.75} fill="none" />
            <Path d="M42 33 58 17" stroke="#F4FBFF" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        </Svg>
    );
}
