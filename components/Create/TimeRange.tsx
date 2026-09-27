import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { Choices } from '@/components/Create/DetailBar';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';

/** Timed, never sprung: the panel changes height and a spring would bounce it. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

const LENGTHS = [15, 30, 45, 60];
const lengthLabel = (minutes: number) => (minutes === 60 ? '1 hr' : `${minutes} min`);

/** "07:30" as a Date today, for the wheel. */
export function timeValue(time?: string): Date {
    const date = new Date();
    const [hour, minute] = (time ?? '08:00').split(':').map(Number);
    date.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 0, 0, 0);
    return date;
}

export const asTime = (date: Date): string =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

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

    return (
        <Animated.View layout={MORPH} style={styles.wrap}>
            <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{startLabel}</Text>
                {/* On screen straight away: this is what the row is for. */}
                <DateTimePicker
                    value={timeValue(start)}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'compact' : 'default'}
                    themeVariant={isLight ? 'light' : 'dark'}
                    accessibilityLabel="Start time"
                    onChange={(_event, selected) => { if (selected) onChange({ start: asTime(selected), minutes }); }}
                />
                {start ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear the time"
                        onPress={() => { lightFeedback(); onChange({ start: undefined, minutes: undefined }); }}
                        style={styles.clear}
                    >
                        <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: FontFamily.regular }}>Clear</Text>
                    </Pressable>
                ) : null}
            </View>

            <Choices
                options={LENGTHS.map(value => ({ id: value, label: lengthLabel(value) }))}
                value={chosen}
                accent={accent}
                onChange={value => {
                    selectionFeedback();
                    // Tapping the one already chosen takes the end off again.
                    onChange({ start: start ?? asTime(timeValue(start)), minutes: value === chosen ? undefined : value });
                }}
            />

            {start && chosen ? (
                <Animated.Text
                    layout={MORPH}
                    entering={FadeIn.duration(160)}
                    style={[styles.ends, { color: accent }]}
                >
                    {`${start} → ${endTime(start, chosen)}`}
                </Animated.Text>
            ) : (
                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                    Pick a length to give it an end, or leave it open.
                </Text>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrap: { gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
    label: { fontSize: 14, fontFamily: FontFamily.regular },
    clear: { paddingVertical: 4, paddingHorizontal: 6 },
    ends: { fontSize: 13, fontFamily: FontFamily.medium, paddingHorizontal: 14, fontVariant: ['tabular-nums'] },
    hint: { fontSize: 12, fontFamily: FontFamily.regular, paddingHorizontal: 14 },
});
