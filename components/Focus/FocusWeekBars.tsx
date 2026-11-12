import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useProgress } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';

const dayLetter = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });

/**
 * Focus per day as bars, the week from its first day: the chart the Focus
 * page draws for 7 days (app/(root)/focus-stats.tsx), shared so Home's Focus
 * card shows the very same thing. The lit day (today, or the one picked)
 * stays bright, the rest step back; days still ahead are empty.
 */
export function FocusWeekBars({ days, today, lit, dim = false, height = vs(150), replay, tint }: {
    days: { date: string; seconds: number }[];
    today: string;
    /** The day drawn bright (defaults to today). */
    lit?: string;
    /** Step back every day but the lit one (a day picked on the Focus page). */
    dim?: boolean;
    height?: number;
    replay?: unknown;
    /** The bars' colour; the accent by default. */
    tint?: string;
}) {
    const t = useTokens();
    const colour = tint ?? t.color.accent;
    const ceiling = Math.max(1, ...days.map(day => day.seconds));
    const bright = lit ?? today;
    return (
        <View>
            <View style={[styles.chart, { height }]}>
                {days.map((day, index) => (
                    <DayBar key={`${String(replay)}-${day.date}`} share={day.date > today ? 0 : day.seconds / ceiling} index={index} replay={replay}
                        tint={day.seconds ? colour : t.color.border} lit={day.date === bright} dim={dim && day.date !== bright} />
                ))}
            </View>
            <View style={styles.axis}>
                {days.map(day => (
                    <Text key={day.date} style={[styles.axisText, { color: day.date === bright ? t.color.textPrimary : t.color.textSubtle }]}>{dayLetter(day.date)}</Text>
                ))}
            </View>
        </View>
    );
}

/** One day's bar, growing in: the lit day bright, the rest stepped back. Shared with the Focus page's 30 days. */
export function DayBar({ share, index, replay, tint, lit, dim }: { share: number; index: number; replay: unknown; tint: string; lit: boolean; dim: boolean }) {
    const grown = useProgress(Math.max(share, 0.03), index * 25, replay);
    const height = useAnimatedStyle(() => ({ height: `${grown.get() * 100}%` }));
    return (
        <View style={styles.barTrack} pointerEvents="none">
            <Animated.View style={[styles.bar, height, { backgroundColor: tint, opacity: lit ? 1 : dim ? 0.3 : 0.6 }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: s(4) },
    barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: s(6), minHeight: vs(4) },
    axis: { flexDirection: 'row', gap: s(4), marginTop: vs(6) },
    axisText: { flex: 1, textAlign: 'center', fontSize: ms(12), fontFamily: FontFamily.regular },
});
