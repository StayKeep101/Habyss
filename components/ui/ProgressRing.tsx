import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTokens } from '@/hooks/useTokens';
import { Text } from './Text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
    /** 0 to 1. A full ring is drawn closed. */
    progress: number;
    size?: 'sm' | 'md' | 'lg';
    tone?: 'accent' | 'success' | 'warning' | 'danger';
    /** What sits in the middle: a number, a percent, a day. */
    label?: string;
    accessibilityLabel?: string;
}

/** The one ring: a faint track and an arc that closes as progress fills. */
export function ProgressRing({ progress, size = 'md', tone = 'accent', label, accessibilityLabel }: ProgressRingProps) {
    const t = useTokens();
    const box = { sm: t.space['3xl'] + t.space.xs, md: t.space['4xl'] * 2, lg: t.space['4xl'] * 4 }[size];
    const stroke = { sm: t.space.xs - 1 / 2, md: t.space.sm, lg: t.space.md }[size];
    const r = (box - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const color = { accent: t.color.accent, success: t.color.success, warning: t.color.warning, danger: t.color.danger }[tone];
    const value = Math.max(0, Math.min(1, progress));
    const shown = useSharedValue(value);
    useEffect(() => {
        shown.set(withTiming(value, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
    }, [value, shown]);
    const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.get()) }));
    return (
        <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
            style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={box} height={box} style={{ position: 'absolute', top: 0, left: 0 }}>
                <Circle cx={box / 2} cy={box / 2} r={r} stroke={t.tint('soft', color)} strokeWidth={stroke} fill="none" />
                <AnimatedCircle cx={box / 2} cy={box / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
                    strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} animatedProps={arc}
                    rotation={-90} origin={`${box / 2}, ${box / 2}`} opacity={value > 0 ? 1 : 0} />
            </Svg>
            {label ? <Text variant={size === 'lg' ? 'display' : size === 'md' ? 'heading' : 'caption'} numeric>{label}</Text> : null}
        </View>
    );
}
