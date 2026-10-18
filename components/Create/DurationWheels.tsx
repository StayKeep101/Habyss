import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Wheel } from '@/components/ui/Wheel';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

const range = (count: number) => Array.from({ length: count }, (_, n) => ({ id: n, label: String(n) }));
const DAYS = range(366);
const HOURS = range(24);
const SIXTY = range(60);

/** Seconds as days, hours, minutes and seconds. */
export function splitDuration(total: number) {
    const seconds = Math.max(0, Math.round(total));
    return {
        days: Math.min(365, Math.floor(seconds / 86400)),
        hours: Math.floor((seconds % 86400) / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        seconds: seconds % 60,
    };
}

/** "4d 6h 30m", leaving out the zero parts. */
export function formatDuration(total: number): string {
    const { days, hours, minutes, seconds } = splitDuration(total);
    const parts = [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, seconds && `${seconds}s`].filter(Boolean);
    return parts.length ? parts.join(' ') : '0';
}

/**
 * How long, on four wheels — days, hours, minutes, seconds — numbers only,
 * with a single letter over each so it is clear which is which.
 */
export function DurationWheels({ seconds, onChange, parts: shownParts = ['days', 'hours', 'minutes', 'seconds'] }: {
    seconds: number;
    onChange: (seconds: number) => void;
    /** Which wheels to show, e.g. hours and minutes for "how long before". */
    parts?: ('days' | 'hours' | 'minutes' | 'seconds')[];
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const parts = splitDuration(seconds);
    const set = (patch: Partial<typeof parts>) => {
        const next = { ...parts, ...patch };
        onChange(next.days * 86400 + next.hours * 3600 + next.minutes * 60 + next.seconds);
    };
    const columns: { key: keyof typeof parts; label: string; options: typeof DAYS }[] = [
        { key: 'days', label: 'd', options: DAYS },
        { key: 'hours', label: 'h', options: HOURS },
        { key: 'minutes', label: 'm', options: SIXTY },
        { key: 'seconds', label: 's', options: SIXTY },
    ];
    return (
        <View style={styles.row}>
            {columns.filter(column => shownParts.includes(column.key)).map(column => (
                <View key={column.key} style={styles.column}>
                    <Text style={[styles.label, { color: colors.textTertiary }]}>{column.label}</Text>
                    <Wheel testID={`duration-${column.key}`} options={column.options} value={parts[column.key]}
                        onChange={value => set({ [column.key]: value })} style={styles.digit} />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.sm },
    column: { flex: 1, alignItems: 'stretch', gap: Spacing.xs },
    label: { textAlign: 'center', fontSize: 12, fontFamily: FontFamily.medium },
    digit: { fontSize: 20, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
});
