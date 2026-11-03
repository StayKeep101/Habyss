import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';
import { Radius, Spacing } from '@/theme/designSystem';
import { MOTION, useProgress } from './Motion';

/** More pieces than this and the bar is drawn in proportion instead, one piece per share. */
const MOST = 16;

/** One piece of the bar, lighting up in turn as the bar arrives. */
function Piece({ on, index, color, empty, replay }: { on: boolean; index: number; color: string; empty: string; replay?: unknown }) {
    const lit = useProgress(on ? 1 : 0, index * MOTION.stagger, replay);
    const style = useAnimatedStyle(() => ({ opacity: lit.get() }));
    return (
        <View style={[styles.piece, { backgroundColor: empty }]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.round, { backgroundColor: color }, style]} />
        </View>
    );
}

/**
 * A bar in pieces, one per thing to do: the done ones lit in cobalt, one
 * after another as it arrives, the rest dark. Reads as "6 of 8" before any
 * number does. Past 16 pieces it keeps 16 and lights them in proportion.
 */
export function SegmentBar({ done, total, color, replay, accessibilityLabel }: {
    done: number; total: number; color?: string; replay?: unknown; accessibilityLabel?: string;
}) {
    const t = useTokens();
    if (total <= 0) return null;
    const pieces = Math.min(total, MOST);
    const lit = total <= MOST ? done : Math.round((done / total) * MOST);
    return (
        <View style={styles.row} accessible accessibilityRole="progressbar"
            accessibilityLabel={accessibilityLabel ?? `${done} of ${total} done`} accessibilityValue={{ min: 0, max: total, now: done }}>
            {Array.from({ length: pieces }, (_, index) => (
                <Piece key={index} index={index} on={index < lit} color={color ?? t.color.cobalt} empty={t.color.surfaceRaised} replay={replay} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.xs, height: Spacing.sm },
    piece: { flex: 1, borderRadius: Radius.pill, overflow: 'hidden' },
    round: { borderRadius: Radius.pill },
});
