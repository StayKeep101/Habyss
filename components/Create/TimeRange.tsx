import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { Wheel } from '@/components/ui/Wheel';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, hour) => ({ id: hour, label: pad(hour) }));
/** Five-minute steps, plus the exact minute when a time is not on one. */
const minutesFor = (minute: number) => {
    const steps = Array.from({ length: 12 }, (_, index) => index * 5);
    if (!steps.includes(minute)) steps.push(minute);
    return steps.sort((a, b) => a - b).map(m => ({ id: m, label: pad(m) }));
};
/** "None" sits above midnight on both hour wheels: no time, or no end. */
const NO_END = -1;
const END_HOURS = [{ id: NO_END, label: '–' }, ...HOURS];
const START_HOURS = END_HOURS;
const split = (time: string) => time.split(':').map(Number) as [number, number];
/** One tap for the usual lengths. */
const LENGTHS = [{ minutes: 1, label: '1 min' }, { minutes: 5, label: '5 min' }, { minutes: 10, label: '10 min' }, { minutes: 30, label: '30 min' }, { minutes: 60, label: '1 hr' }, { minutes: 120, label: '2 hr' }];

/** "07:30" as a Date today, for the wheel. */
export function timeValue(time?: string): Date {
    const date = new Date();
    const [hour, minute] = (time ?? '08:00').split(':').map(Number);
    date.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 0, 0, 0);
    return date;
}

export const asTime = (date: Date): string =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * How long from one time to another, rolling past midnight.
 *
 * An end before the start is read as the next day rather than as a negative
 * length — somebody setting 23:00 to 00:30 means an hour and a half, not minus
 * twenty-two and a half hours.
 */
export function lengthBetween(start: string, end: string): number {
    const minutes = (time: string) => {
        const [hour, minute] = time.split(':').map(Number);
        return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
    };
    const span = minutes(end) - minutes(start);
    return span > 0 ? span : span + 24 * 60;
}

/** Where a start plus a length lands, rolling past midnight if it has to. */
export function endTime(start: string, minutes: number): string {
    const date = timeValue(start);
    date.setMinutes(date.getMinutes() + minutes);
    return asTime(date);
}

/**
 * When it starts, and when it is over: two wheels side by side, hours and
 * minutes each, the way the Clock app sets a time. Either can be "–": turn
 * the start's hour to it for no time at all, the end's for no end. The ×
 * beside End appears only once an end is set, and takes just the end away.
 * Stored as a length, so a habit that moves keeps how long it takes rather
 * than when it used to end. Above them, the usual lengths in one tap: they
 * move the end, never the start.
 */
export const TimeRange: React.FC<{
    start?: string;
    minutes?: number;
    onChange: (next: { start?: string; minutes?: number }) => void;
    accent: string;
    /** Named for what it is in this sheet: a habit starts, a task is due. */
    startLabel?: string;
}> = ({ start, minutes, onChange, accent, startLabel = 'Start' }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback } = useHaptics();

    const from = start ?? asTime(timeValue(start));
    const [fromHour, startMinute] = split(from);
    const startHour = start ? fromHour : NO_END;
    const end = minutes ? endTime(from, minutes) : null;
    const [endHour, endMinute] = end ? split(end) : [NO_END, 0];

    const setStart = (hour: number, minute: number) => {
        if (hour === NO_END) { onChange({ start: undefined, minutes: undefined }); return; }
        onChange({ start: `${pad(hour)}:${pad(minute)}`, minutes });
    };
    const setEnd = (hour: number, minute: number) => {
        if (hour === NO_END) { onChange({ start, minutes: undefined }); return; }
        onChange({ start: from, minutes: lengthBetween(from, `${pad(hour)}:${pad(minute)}`) });
    };

    return (
        <View style={styles.column}>
        <View style={styles.lengths}>
            {LENGTHS.map(length => (
                <ChoicePill key={length.minutes} label={length.label} on={minutes === length.minutes} color={accent}
                    pressStyle={styles.flex} style={styles.length} textStyle={styles.lengthText}
                    accessibilityLabel={`Takes ${length.label}`}
                    // The start stays where it is; the end lands this far after it.
                    onPress={() => { lightFeedback(); onChange({ start, minutes: length.minutes }); }} />
            ))}
        </View>
        <View style={styles.wrap}>
            <View style={styles.side}>
                <View style={styles.head}>
                    <Text style={[styles.label, { color: colors.textTertiary }]}>{startLabel}</Text>
                </View>
                <View style={styles.wheels}>
                    <Wheel testID="start-hour" options={START_HOURS} value={startHour} onChange={hour => setStart(hour, startMinute)} style={styles.digit} />
                    <Text style={[styles.colon, { color: colors.textTertiary }]}>:</Text>
                    <View style={[styles.flex, !start && styles.unset]} pointerEvents={start ? 'auto' : 'none'}>
                        <Wheel testID="start-minute" options={minutesFor(startMinute)} value={startMinute} onChange={minute => setStart(fromHour, minute)} style={styles.digit} />
                    </View>
                </View>
            </View>
            <View style={styles.side}>
                <View style={styles.head}>
                    <Text style={[styles.label, { color: colors.textTertiary }]}>End</Text>
                    {end ? <IconButton icon="close" label="Clear the end" diameter={24} size={12}
                        onPress={() => { lightFeedback(); onChange({ start, minutes: undefined }); }} /> : null}
                </View>
                <View style={[styles.wheels, !start && styles.unset]} pointerEvents={start ? 'auto' : 'none'}>
                    <Wheel testID="end-hour" options={END_HOURS} value={endHour} onChange={hour => setEnd(hour, endMinute)} style={styles.digit} />
                    <Text style={[styles.colon, { color: colors.textTertiary }]}>:</Text>
                    <View style={[styles.flex, endHour === NO_END && styles.unset]} pointerEvents={endHour === NO_END ? 'none' : 'auto'}>
                        <Wheel testID="end-minute" options={minutesFor(endMinute)} value={endMinute} onChange={minute => setEnd(endHour, minute)} style={styles.digit} />
                    </View>
                </View>
            </View>
        </View>
        </View>
    );
};

const styles = StyleSheet.create({
    column: { gap: Spacing.md },
    lengths: { flexDirection: 'row', gap: Spacing.xs },
    length: { paddingHorizontal: Spacing.xs },
    lengthText: { fontSize: 12 },
    wrap: { flexDirection: 'row', gap: Spacing.lg },
    side: { flex: 1, gap: Spacing.xs },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 24 },
    label: { fontSize: 12, fontFamily: FontFamily.medium },
    wheels: { flexDirection: 'row', alignItems: 'center' },
    flex: { flex: 1 },
    unset: { opacity: 0.45 },
    colon: { fontSize: 18, fontFamily: FontFamily.bold },
    digit: { fontSize: 20, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
});
