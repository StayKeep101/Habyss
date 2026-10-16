import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { Reveal } from '@/components/ui/Motion';

/**
 * Someone's Marks over the last two months, as the backdrop of a profile with
 * no cover photo: a soft accent curve rising across the top of the page.
 * Decorative — the number itself is on the level card below.
 */
export function MarksBackdrop({ series, width, height, color }: {
    series: number[]; width: number; height: number; color: string;
}) {
    if (series.length < 2 || width <= 0) return null;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = Math.max(1, max - min);
    // Above the photo, where nothing covers it: from under the status bar to
    // just over the avatar's top edge.
    const top = height * 0.22;
    const bottom = height * 0.62;
    const points = series.map((value, index) => ({
        x: (index / (series.length - 1)) * width,
        y: bottom - ((value - min) / span) * (bottom - top),
    }));
    // A smooth line through the points (midpoint quadratic curves).
    let line = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const point = points[i];
        const midX = (prev.x + point.x) / 2;
        const midY = (prev.y + point.y) / 2;
        line += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
    }
    line += ` T ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    const area = `${line} L ${width} ${height} L 0 ${height} Z`;

    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap]}>
            <Reveal style={{ height }}>
                <Svg width={width} height={height}>
                    <Defs>
                        <SvgGradient id="marks-fill" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={color} stopOpacity={0.6} />
                            <Stop offset="1" stopColor={color} stopOpacity={0.05} />
                        </SvgGradient>
                    </Defs>
                    <Path d={area} fill="url(#marks-fill)" />
                    <Path d={line} stroke={color} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            </Reveal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { overflow: 'hidden' },
});
