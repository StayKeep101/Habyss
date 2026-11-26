import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Line, Rect } from 'react-native-svg';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { GrowBar } from './Motion';
import { Text } from './Text';
import { Spacing } from '@/theme/designSystem';

export interface WeekBar {
    key: string;
    /** The day's letter under its bar. */
    label: string;
    /** Null: nothing recorded (a stub, not a zero). */
    value: number | null;
    /** A day still to come: an empty stub. */
    ahead?: boolean;
    today?: boolean;
}

/**
 * A week as bars, the way health apps draw one: rounded bars that grow in, the
 * goal as a dashed line across, a bar that reaches it in `metColor`, today's
 * letter in full. Drag a finger across to read any day (`onPick` gets its
 * index, then null when the finger lifts); the other days dim.
 */
export function WeekBars({ days, goal, color, metColor, onPick, picked, replay, accessibilityLabel, height }: {
    days: WeekBar[];
    goal: number;
    color: string;
    metColor: string;
    onPick?: (index: number | null) => void;
    picked?: number | null;
    replay?: unknown;
    accessibilityLabel: string;
    /** The plot's height; the space's 4xl × 2 by default. */
    height?: number;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [width, setWidth] = useState(0);
    const plot = height ?? t.space['4xl'] * 2;
    const top = Math.max(goal * 1.15, ...days.map(day => day.value ?? 0)) || 1;
    const column = width / Math.max(1, days.length);
    const bar = Math.min(t.space.lg + t.space.xs, column * 0.5);
    const stub = t.space.xs;
    const goalY = plot - (goal / top) * plot;

    const pick = (x: number) => {
        if (!onPick || !width) return;
        const index = Math.max(0, Math.min(days.length - 1, Math.floor(x / column)));
        if (days[index].ahead) return;
        if (index !== picked) selectionFeedback();
        onPick(index);
    };
    const scrub = Gesture.Pan()
        .activeOffsetX([-4, 4])
        .failOffsetY([-12, 12])
        .onBegin(event => { runOnJS(pick)(event.x); })
        .onUpdate(event => { runOnJS(pick)(event.x); })
        .onFinalize(() => { if (onPick) runOnJS(onPick)(null); });

    return (
        <GestureDetector gesture={scrub}>
            <View accessible accessibilityLabel={accessibilityLabel} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
                {width ? (
                    <Svg width={width} height={plot}>
                        {days.map((day, index) => {
                            const x = index * column + (column - bar) / 2;
                            const dim = picked !== null && picked !== undefined && picked !== index ? 0.35 : 1;
                            if (day.ahead || !day.value) {
                                return <Rect key={day.key} x={x} y={plot - stub} width={bar} height={stub} rx={stub / 2} fill={t.color.surfaceRaised} opacity={dim} />;
                            }
                            const h = Math.max(stub, (day.value / top) * plot);
                            return (
                                <GrowBar key={`${day.key}-${replay ?? ''}`} x={x} width={bar} floor={plot} height={h} rx={Math.min(bar / 2, t.space.sm)}
                                    fill={day.value >= goal ? metColor : color} opacity={dim} delay={index * (t.space.xl * 2)} replay={replay} />
                            );
                        })}
                        {/* The goal, dashed across the week. */}
                        <Line x1={0} x2={width} y1={goalY} y2={goalY} stroke={t.color.textSubtle} strokeWidth={1} strokeDasharray={`${t.space.xs} ${t.space.xs}`} opacity={0.6} />
                    </Svg>
                ) : <View style={{ height: plot }} />}
                <View style={styles.labels}>
                    {days.map((day, index) => (
                        <View key={day.key} style={styles.label}>
                            <Text variant="caption" align="center" tone={day.today || picked === index ? 'primary' : 'muted'}>{day.label}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    labels: { flexDirection: 'row', marginTop: Spacing.sm },
    label: { flex: 1 },
});
