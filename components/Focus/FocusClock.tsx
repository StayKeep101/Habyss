import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { FontFamily } from '@/theme/designSystem';
import { clockText, type ClockStyle } from '@/lib/focusClock';

const FOCUS_TEXT = '#FFFFFF';
const FOCUS_DIM = 'rgba(255,255,255,0.35)';

/**
 * The focus clock, drawn as cheaply as possible: plain text and, for the
 * ring, one arc that moves once a second. No animation runs between ticks,
 * so a phone left on its side for hours spends almost nothing drawing it.
 * Sized from the screen, so on its side it fills the width.
 */
export function FocusClock({ seconds, progress, style, accent, label }: {
    /** What to show: time left for a timer, time spent for a stopwatch. */
    seconds: number;
    /** 0–1 for a timer; null for a stopwatch. */
    progress: number | null;
    style: ClockStyle;
    accent: string;
    label?: string;
}) {
    const { width, height } = useWindowDimensions();
    const landscape = width > height;
    const text = clockText(seconds);
    const long = text.length > 5;
    const size = Math.min(width, height) * (landscape ? 0.82 : 0.78);
    const digits = (landscape ? width * 0.2 : width * 0.21) * (long ? 0.78 : 1);

    if (style === 'ring') {
        const stroke = 6;
        const r = (size - stroke) / 2;
        const c = 2 * Math.PI * r;
        return (
            <View style={[styles.center, { width: size, height: size }]}>
                <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                    <Circle cx={size / 2} cy={size / 2} r={r} stroke={FOCUS_DIM} strokeOpacity={0.25} strokeWidth={stroke} fill="none" />
                    <Circle cx={size / 2} cy={size / 2} r={r} stroke={accent} strokeWidth={stroke} fill="none" strokeLinecap="round"
                        strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - (progress ?? 1))} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
                </Svg>
                <Text style={[styles.digits, { fontSize: digits * 0.62, color: FOCUS_TEXT }]}>{text}</Text>
                {label ? <Text style={[styles.label, { color: FOCUS_DIM }]}>{label}</Text> : null}
            </View>
        );
    }
    if (style === 'minimal') {
        return (
            <View style={styles.center}>
                <Text style={[styles.thin, { fontSize: digits * 1.05, color: FOCUS_TEXT }]}>{text}</Text>
                {progress !== null ? (
                    <View style={[styles.line, { width: size, backgroundColor: FOCUS_DIM }]}>
                        <View style={[styles.lineFill, { width: `${Math.round((progress ?? 0) * 100)}%`, backgroundColor: accent }]} />
                    </View>
                ) : null}
            </View>
        );
    }
    return (
        <View style={styles.center}>
            <Text style={[styles.digits, { fontSize: digits, color: FOCUS_TEXT }]}>{text}</Text>
            {label ? <Text style={[styles.label, { color: FOCUS_DIM }]}>{label}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center' },
    digits: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -2 },
    thin: { fontFamily: FontFamily.regular, fontVariant: ['tabular-nums'], letterSpacing: -3 },
    label: { fontFamily: FontFamily.medium, fontSize: 15, marginTop: 6 },
    line: { height: 2, marginTop: 18, borderRadius: 1, overflow: 'hidden' },
    lineFill: { height: '100%' },
});
