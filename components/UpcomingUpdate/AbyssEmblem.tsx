import React from 'react';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';

/** A fractured timepiece, not a final character design. Static for reduced motion. */
export function AbyssEmblem({ accent }: { accent: string }) {
    return (
        <Svg width="100%" height={200} viewBox="0 0 320 200" accessible={false}>
            <Defs>
                <RadialGradient id="abyssLight">
                    <Stop offset="0" stopColor={accent} stopOpacity={0.22} />
                    <Stop offset="1" stopColor={accent} stopOpacity={0} />
                </RadialGradient>
            </Defs>
            <Circle cx={160} cy={100} r={100} fill="url(#abyssLight)" />
            <G fill="none" stroke={accent} strokeLinecap="round">
                <Path d="M 103 153 A 78 78 0 1 1 232 130" strokeWidth={1} opacity={0.3} />
                <Path d="M 119 147 A 62 62 0 1 1 220 84" strokeWidth={3} />
                <Path d="M 217 108 A 62 62 0 0 1 179 159" strokeWidth={3} opacity={0.65} />
                <Path d="M 150 39 L 150 47 M 208 66 L 202 72 M 222 96 L 214 96 M 104 74 L 110 78 M 98 106 L 106 106" strokeWidth={2} opacity={0.6} />
                <Line x1={160} y1={100} x2={160} y2={65} strokeWidth={2} />
                <Line x1={160} y1={100} x2={184} y2={114} strokeWidth={2} />
                <Path d="M 139 159 L 152 150 L 157 168 L 145 177 Z" strokeWidth={1.5} />
                <Path d="M 247 48 L 252 38 L 256 50 L 250 56 Z" opacity={0.6} />
            </G>
            <Circle cx={160} cy={100} r={4} fill={accent} />
            <Circle cx={78} cy={48} r={2} fill={accent} opacity={0.5} />
            <Circle cx={243} cy={157} r={2} fill={accent} opacity={0.5} />
        </Svg>
    );
}
