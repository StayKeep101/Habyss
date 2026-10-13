import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing, ReduceMotion, interpolate, useAnimatedStyle,
    useSharedValue, withDelay, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';

const EASE = { duration: 520, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
/** Enough marks to read as time, few enough to stay legible on a phone. */
const MARKS = 44;

/**
 * How long is left, drawn rather than written.
 *
 * This page exists to answer one question — how long until the day I said —
 * and a sentence answers it in a way nobody feels. So it is a ruler of time:
 * every mark is a slice of the whole run, the ones behind you are spent, the
 * one you are standing on is lit, and the ones ahead are what is left.
 *
 * The number stays, because "23 days" is the fact. The ruler is what makes 23
 * out of 200 feel different from 23 out of 30, which is the part a sentence
 * cannot carry.
 */
export const Countdown: React.FC<{
    /** Days from the start to the target. */
    span: number;
    /** Days remaining; negative once the day has passed. */
    left: number;
    /** What the goal is called, for the line under the number. */
    endLabel: string;
}> = ({ span, left, endLabel }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary } = useAccentGradient();

    const total = Math.max(1, span);
    const remaining = Math.max(0, left);
    const elapsed = Math.min(1, Math.max(0, (total - remaining) / total));
    const overdue = left < 0;
    const done = left === 0 && span > 0;

    // Close enough to matter: the last tenth, or the last week, whichever is
    // longer — a short goal should not feel urgent for most of its life.
    const soon = !overdue && remaining > 0 && remaining <= Math.max(7, Math.round(total * 0.1));
    const tint = overdue ? colors.error : soon ? colors.warning : primary;

    const grown = useSharedValue(0);
    useEffect(() => { grown.value = withTiming(1, EASE); }, [grown, elapsed]);

    const number = useAnimatedStyle(() => ({
        opacity: grown.value,
        transform: [{ translateY: interpolate(grown.value, [0, 1], [10, 0]) }],
    }));

    const headline = overdue ? Math.abs(left) : remaining;
    const unit = headline === 1 ? 'day' : 'days';
    const caption = overdue
        ? `past ${endLabel}`
        : done ? `${endLabel} is today`
            : `until ${endLabel}`;

    return (
        <View style={styles.wrap}>
            <Animated.View style={[styles.headline, number]}>
                <Text style={[styles.number, { color: tint }]}>{headline}</Text>
                <Text style={[styles.unit, { color: colors.textSecondary }]}>{unit}</Text>
            </Animated.View>
            <Text style={[styles.caption, { color: colors.textTertiary }]}>{caption}</Text>

            {/* The run itself. Spent marks behind, today lit, what is left ahead. */}
            <View
                style={styles.ruler}
                accessibilityRole="progressbar"
                accessibilityLabel={`${headline} ${unit} ${overdue ? 'past' : 'until'} ${endLabel}`}
                accessibilityValue={{ min: 0, max: total, now: total - remaining }}
            >
                {Array.from({ length: MARKS }, (_, index) => (
                    <Mark
                        key={index}
                        index={index}
                        share={index / (MARKS - 1)}
                        elapsed={elapsed}
                        grown={grown}
                        tint={tint}
                        spent={isLight ? 'rgba(15,23,42,0.13)' : 'rgba(255,255,255,0.14)'}
                    />
                ))}
            </View>
        </View>
    );
};

/**
 * One slice of the run.
 *
 * The mark you are standing on is taller and fully lit; the ones ahead fade
 * with distance, so the eye lands on now rather than on either end.
 */
const Mark: React.FC<{
    index: number; share: number; elapsed: number;
    grown: SharedValue<number>; tint: string; spent: string;
}> = ({ index, share, elapsed, grown, tint, spent }) => {
    const past = share < elapsed;
    // Within half a slice of the present.
    const here = Math.abs(share - elapsed) < 0.5 / MARKS;

    const style = useAnimatedStyle(() => {
        const on = withDelay(index * 9, withTiming(1, EASE));
        const ahead = Math.max(0, share - elapsed);
        return {
            opacity: grown.value * (past ? 0.5 : here ? 1 : interpolate(ahead, [0, 0.6], [0.95, 0.3], 'clamp')) * on,
            transform: [{ scaleY: here ? 1.55 : past ? 0.72 : 1 }],
        };
    });

    return <Animated.View style={[styles.mark, style, { backgroundColor: past ? spent : tint }]} />;
};

const styles = StyleSheet.create({
    wrap: { gap: vs(6), paddingVertical: vs(4) },
    headline: { flexDirection: 'row', alignItems: 'baseline', gap: s(7) },
    number: { fontSize: ms(46), lineHeight: ms(52), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -1 },
    unit: { fontSize: ms(16), fontFamily: FontFamily.medium },
    caption: { fontSize: ms(12), fontFamily: FontFamily.regular },
    ruler: { flexDirection: 'row', alignItems: 'center', gap: s(3), height: vs(26), marginTop: vs(4) },
    mark: { flex: 1, height: vs(14), borderRadius: s(2), minWidth: 2 },
});
