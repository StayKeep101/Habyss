import React from 'react';
import { formatDuration } from '@/lib/habitMeasurement';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { Choices } from '@/components/Create/DetailBar';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

/** Timed, never sprung: the panel changes height and a spring would bounce it. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

const LENGTHS = [15, 30, 45, 60];
const lengthLabel = (minutes: number) => formatDuration(minutes * 60, true);

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
 * When it starts, and when it is over.
 *
 * These were two separate rows — a time, and a length somewhere else — which
 * made setting both a round trip and left the sheet with a row that only ever
 * held four buttons. They are one question, so they are one row.
 *
 * The wheel is on screen from the moment the row opens. Hiding a time picker
 * behind a "Set a start time" button costs a tap to reach the thing the row
 * exists for, and tells you nothing in exchange.
 *
 * An end is optional and there is no "no length" button for it: tapping the
 * length you already chose takes it off again, which is what tapping a chosen
 * thing should do anyway.
 */
export const TimeRange: React.FC<{
    start?: string;
    minutes?: number;
    onChange: (next: { start?: string; minutes?: number }) => void;
    accent: string;
    /** Named for what it is in this sheet: a habit starts, a task is due. */
    startLabel?: string;
}> = ({ start, minutes, onChange, accent, startLabel = 'Starts at' }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { lightFeedback, selectionFeedback } = useHaptics();

    const chosen = minutes && LENGTHS.includes(minutes) ? minutes : 0;
    /** The start the end is measured from, whether or not one was set. */
    const from = start ?? asTime(timeValue(start));
    const end = minutes ? endTime(from, minutes) : null;

    return (
        <Animated.View layout={MORPH} style={styles.wrap}>
            {/* Start on the left, end on the right: the range reads the way
                it happens, and both ends are in view at once. */}
            <View style={styles.pair}>
                <View style={[styles.side, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }]}>
                    <View style={styles.sideHead}>
                        <Text style={[styles.sideLabel, { color: colors.textTertiary }]}>{startLabel}</Text>
                        {start ? (
                            <Pressable accessibilityRole="button" accessibilityLabel="Clear the time" hitSlop={8}
                                onPress={() => { lightFeedback(); onChange({ start: undefined, minutes: undefined }); }}>
                                <Text style={[styles.clearText, { color: colors.textTertiary }]}>Clear</Text>
                            </Pressable>
                        ) : null}
                    </View>
                    <DateTimePicker
                        value={timeValue(start)}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'compact' : 'default'}
                        themeVariant={isLight ? 'light' : 'dark'}
                        accessibilityLabel="Start time"
                        style={styles.picker}
                        onChange={(_event, selected) => { if (selected) onChange({ start: asTime(selected), minutes }); }}
                    />
                </View>

                <Text style={[styles.arrow, { color: colors.textTertiary }]}>→</Text>

                <View style={[styles.side, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }]}>
                    <View style={styles.sideHead}>
                        <Text style={[styles.sideLabel, { color: colors.textTertiary }]}>Ends at</Text>
                        {end ? (
                            <Pressable accessibilityRole="button" accessibilityLabel="Clear the end time" hitSlop={8}
                                onPress={() => { lightFeedback(); onChange({ start, minutes: undefined }); }}>
                                <Text style={[styles.clearText, { color: colors.textTertiary }]}>Clear</Text>
                            </Pressable>
                        ) : null}
                    </View>
                    {end ? (
                        <DateTimePicker
                            value={timeValue(end)}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            themeVariant={isLight ? 'light' : 'dark'}
                            accessibilityLabel="End time"
                            style={styles.picker}
                            onChange={(_event, selected) => {
                                if (!selected) return;
                                // Stored as a length, so a habit that moves keeps
                                // how long it takes rather than when it used to end.
                                onChange({ start: from, minutes: lengthBetween(from, asTime(selected)) });
                            }}
                        />
                    ) : (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Give it an end time"
                            onPress={() => { selectionFeedback(); onChange({ start: from, minutes: 30 }); }}
                            style={styles.add}
                        >
                            <Text style={{ color: accent, fontSize: 15, fontFamily: FontFamily.semibold }}>+ Add end</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            <Choices
                options={LENGTHS.map(value => ({ id: value, label: lengthLabel(value) }))}
                value={chosen}
                accent={accent}
                onChange={value => {
                    selectionFeedback();
                    // Tapping the one already chosen takes the end off again.
                    onChange({ start: from, minutes: value === chosen ? undefined : value });
                }}
            />

            {start && minutes ? (
                <Animated.Text
                    layout={MORPH}
                    entering={FadeIn.duration(160)}
                    style={[styles.ends, { color: accent }]}
                >
                    {`${start} → ${endTime(start, minutes)} · ${lengthLabel(minutes)}`}
                </Animated.Text>
            ) : (
                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                    Give it an end, or leave it open.
                </Text>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrap: { gap: 10 },
    pair: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    side: { flex: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
    sideHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sideLabel: { fontSize: 12, fontFamily: FontFamily.medium },
    clearText: { fontSize: 11, fontFamily: FontFamily.medium },
    picker: { alignSelf: 'flex-start', marginLeft: -8 },
    arrow: { alignSelf: 'center', fontSize: 16 },
    label: { fontSize: 14, fontFamily: FontFamily.regular },
    clear: { paddingVertical: 4, paddingHorizontal: 6 },
    add: { paddingVertical: 6 },
    ends: { fontSize: 13, fontFamily: FontFamily.medium, paddingHorizontal: 14, fontVariant: ['tabular-nums'] },
    hint: { fontSize: 12, fontFamily: FontFamily.regular, paddingHorizontal: 14 },
});
