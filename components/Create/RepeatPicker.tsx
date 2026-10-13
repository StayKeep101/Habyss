import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { Choices } from '@/components/Create/DetailBar';
import { Wheel } from '@/components/ui/Wheel';
import { Segmented } from '@/components/ui/Segmented';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import {
    DAILY, WEEKDAYS, WEEKDAYS_ONLY, WEEKENDS_ONLY, WEEKDAY_NAME, describe,
    type DaySelector, type Ordinal, type Recurrence, type Weekday,
} from '@/lib/recurrence';

/** Timed, never sprung: the panel changes height and a spring would bounce it. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

type Preset = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly' | 'hourly';
type Kind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'hourly';

/** The kinds of rule, as a segmented control: all of them visible, one tap each. */
const KINDS: { id: Kind; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
    { id: 'hourly', label: 'Hourly' },
];

const ORDINALS: { id: Ordinal; label: string }[] = [
    { id: 1, label: 'First' }, { id: 2, label: 'Second' }, { id: 3, label: 'Third' },
    { id: 4, label: 'Fourth' }, { id: 5, label: 'Fifth' }, { id: -1, label: 'Last' },
];

const SELECTORS: { id: DaySelector; label: string }[] = [
    ...WEEKDAYS.map(day => ({ id: day as DaySelector, label: WEEKDAY_NAME[day].slice(0, 3) })),
    { id: 'day', label: 'Day' }, { id: 'weekday', label: 'Weekday' }, { id: 'weekend', label: 'Weekend' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Which preset a rule is showing, so reopening the sheet lands where you left it. */
function presetOf(rule: Recurrence): Preset {
    if (rule.kind === 'hourly') return 'hourly';
    if (rule.kind === 'daily') return 'daily';
    if (rule.kind === 'monthly') return 'monthly';
    if (rule.kind === 'yearly') return 'yearly';
    const days = rule.weekdays;
    if (rule.every === 1 && days.length === 5 && ['mon', 'tue', 'wed', 'thu', 'fri'].every(day => days.includes(day as Weekday))) return 'weekdays';
    if (rule.every === 1 && days.length === 2 && days.includes('sat') && days.includes('sun')) return 'weekends';
    if (rule.every === 1 && days.length === 7) return 'daily';
    return 'weekly';
}

/** A sensible starting rule when the user picks a preset. */
function ruleForPreset(preset: Preset, current: Recurrence): Recurrence {
    const every = 'every' in current ? current.every : 1;
    switch (preset) {
        case 'daily': return DAILY;
        case 'weekdays': return WEEKDAYS_ONLY;
        case 'weekends': return WEEKENDS_ONLY;
        case 'hourly': return { kind: 'hourly', every: Math.max(1, every) };
        case 'weekly':
            return { kind: 'weekly', every, weekdays: current.kind === 'weekly' && current.weekdays.length ? current.weekdays : ['mon'] };
        case 'monthly':
            return current.kind === 'monthly' ? current : { kind: 'monthly', every, dates: [1] };
        case 'yearly':
            return current.kind === 'yearly' ? current : { kind: 'yearly', every, months: [0] };
    }
}

/**
 * Saying how often a habit comes round.
 *
 * The seven ordinary answers sit on top as chips, because almost everyone
 * wants one of them and should not have to build it. Choosing one that takes
 * detail — weekly, monthly, yearly — opens exactly the detail it needs and
 * nothing else, so the panel is never a form of mostly-irrelevant controls.
 *
 * Underneath it all is one sentence saying what the rule actually means. That
 * line is the point: a recurrence you cannot read back is one you cannot
 * trust, and it is the same sentence the closed chip shows.
 */
export const RepeatPicker: React.FC<{
    value: Recurrence;
    onChange: (rule: Recurrence) => void;
    accent: string;
}> = ({ value, onChange, accent }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { lightFeedback } = useHaptics();

    const preset = presetOf(value);
    const every = 'every' in value ? value.every : 1;
    const unitWord = value.kind === 'hourly' ? 'hours' : value.kind === 'daily' ? 'days'
        : value.kind === 'weekly' ? 'weeks' : value.kind === 'monthly' ? 'months' : 'years';

    const setEvery = (text: string) => {
        const parsed = Number(text.replace(/[^0-9]/g, ''));
        onChange({ ...value, every: Math.min(99, Math.max(1, Number.isFinite(parsed) && parsed > 0 ? parsed : 1)) });
    };

    const toggle = <T,>(list: T[], item: T): T[] =>
        list.includes(item) ? list.filter(one => one !== item) : [...list, item];

    return (
        <Animated.View layout={MORPH} style={styles.wrap}>
            {/* Every kind on screen at once, as iOS does it. Weekdays and
                weekends are weekly rules, so they live under Weekly as one-tap
                shortcuts beside the days themselves. */}
            <View style={styles.segmented}>
                <Segmented
                    accessibilityLabel="Kind of repeat"
                    options={KINDS}
                    value={(preset === 'weekdays' || preset === 'weekends' ? 'weekly' : preset) as Kind}
                    onChange={kind => onChange(ruleForPreset(kind, value))}
                />
            </View>

            {/* "Every N ___" — only where an interval means anything. */}
            {preset !== 'weekdays' && preset !== 'weekends' ? (
                <Animated.View layout={MORPH} style={styles.everyRow}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Every</Text>
                    <TextInput
                        value={String(every)}
                        onChangeText={setEvery}
                        keyboardType="number-pad"
                        maxLength={2}
                        accessibilityLabel="How often it repeats"
                        style={[styles.number, {
                            color: colors.textPrimary, borderColor: colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                        }]}
                    />
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{unitWord}</Text>
                </Animated.View>
            ) : null}

            {/* Weekly: which days of the week, with the two common sets a tap away. */}
            {value.kind === 'weekly' ? (
                <View style={styles.shortcuts}>
                    {(['weekdays', 'weekends'] as const).map(id => {
                        const on = preset === id;
                        return (
                            <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: on }}
                                onPress={() => { lightFeedback(); onChange(ruleForPreset(id, value)); }}
                                style={[styles.shortcut, {
                                    backgroundColor: on ? accent + '22' : isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)',
                                    borderColor: on ? accent + '66' : 'transparent',
                                }]}>
                                <Text style={{ color: on ? accent : colors.textSecondary, fontSize: 12, fontFamily: FontFamily.medium }}>
                                    {id === 'weekdays' ? 'Weekdays' : 'Weekends'}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            ) : null}
            {value.kind === 'weekly' ? (
                <Animated.View layout={MORPH} entering={FadeIn.duration(180)} style={styles.days}>
                    {WEEKDAYS.map(day => {
                        const on = value.weekdays.includes(day);
                        return (
                            <Pressable
                                key={day}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: on }}
                                accessibilityLabel={WEEKDAY_NAME[day]}
                                onPress={() => { lightFeedback(); onChange({ ...value, weekdays: toggle(value.weekdays, day) }); }}
                                style={[styles.day, {
                                    backgroundColor: on ? accent : isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)',
                                    borderColor: on ? accent : 'transparent',
                                }]}
                            >
                                <Text style={{ color: on ? '#FFFFFF' : colors.textSecondary, fontSize: 13, fontFamily: FontFamily.semibold }}>
                                    {WEEKDAY_NAME[day].slice(0, 1)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </Animated.View>
            ) : null}

            {/* Monthly: a date in the month, or the nth kind of day. */}
            {value.kind === 'monthly' ? (
                <Animated.View layout={MORPH} entering={FadeIn.duration(180)} style={styles.section}>
                    <Choices
                        options={[{ id: 'each', label: 'Each' }, { id: 'onthe', label: 'On the' }]}
                        value={'dates' in value ? 'each' : 'onthe'}
                        accent={accent}
                        onChange={id => onChange(id === 'each'
                            ? { kind: 'monthly', every, dates: [1] }
                            : { kind: 'monthly', every, ordinal: 1, day: 'mon' })}
                    />
                    {'dates' in value ? (
                        <View style={styles.grid}>
                            {Array.from({ length: 31 }, (_, index) => index + 1).map(date => {
                                const on = value.dates.includes(date);
                                return (
                                    <Pressable
                                        key={date}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: on }}
                                        accessibilityLabel={`Day ${date}`}
                                        onPress={() => { lightFeedback(); onChange({ ...value, dates: toggle(value.dates, date) }); }}
                                        style={[styles.cell, {
                                            backgroundColor: on ? accent + '22' : isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)',
                                            borderColor: on ? accent + '66' : 'transparent',
                                        }]}
                                    >
                                        <Text style={{ color: on ? accent : colors.textSecondary, fontSize: 12, fontFamily: FontFamily.medium }}>{date}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : (
                        <OnThe
                            ordinal={value.ordinal}
                            day={value.day}
                            onOrdinal={ordinal => onChange({ ...value, ordinal })}
                            onDay={day => onChange({ ...value, day })}
                        />
                    )}
                </Animated.View>
            ) : null}

            {/* Yearly: which months, and optionally the nth kind of day. */}
            {value.kind === 'yearly' ? (
                <Animated.View layout={MORPH} entering={FadeIn.duration(180)} style={styles.section}>
                    <View style={styles.grid}>
                        {MONTHS.map((name, index) => {
                            const on = value.months.includes(index);
                            return (
                                <Pressable
                                    key={name}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: on }}
                                    accessibilityLabel={name}
                                    onPress={() => { lightFeedback(); onChange({ ...value, months: toggle(value.months, index) }); }}
                                    style={[styles.month, {
                                        backgroundColor: on ? accent + '22' : isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)',
                                        borderColor: on ? accent + '66' : 'transparent',
                                    }]}
                                >
                                    <Text style={{ color: on ? accent : colors.textSecondary, fontSize: 12, fontFamily: FontFamily.medium }}>{name}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <Choices
                        options={[{ id: 'date', label: 'Same date' }, { id: 'onthe', label: 'On the' }]}
                        value={'ordinal' in value ? 'onthe' : 'date'}
                        accent={accent}
                        onChange={id => onChange(id === 'onthe'
                            ? { kind: 'yearly', every, months: value.months, ordinal: 1, day: 'mon' }
                            : { kind: 'yearly', every, months: value.months })}
                    />
                    {'ordinal' in value ? (
                        <OnThe
                            ordinal={value.ordinal}
                            day={value.day}
                            onOrdinal={ordinal => onChange({ ...value, ordinal })}
                            onDay={day => onChange({ ...value, day })}
                        />
                    ) : null}
                </Animated.View>
            ) : null}

            {/* What it all means, in one sentence. */}
            <Animated.Text layout={MORPH} style={[styles.summary, { color: accent }]}>
                {describe(value)}
            </Animated.Text>
        </Animated.View>
    );
};

/**
 * "The third Sunday", as two wheels beside each other.
 *
 * Stacked rows of chips made the reader assemble the phrase out of two
 * unrelated lists — and with five ordinals and ten day kinds, both of them
 * wrapped. Side by side, the two columns read left to right as the sentence
 * they are: "the" / "third" / "Sunday".
 */
const OnThe: React.FC<{
    ordinal: Ordinal;
    day: DaySelector;
    onOrdinal: (value: Ordinal) => void;
    onDay: (value: DaySelector) => void;
}> = ({ ordinal, day, onOrdinal, onDay }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={styles.onThe}>
            <Text style={[styles.onTheWord, { color: colors.textSecondary }]}>the</Text>
            <Wheel options={ORDINALS} value={ordinal} onChange={value => onOrdinal(value as Ordinal)} />
            <Wheel options={SELECTORS} value={day} onChange={value => onDay(value as DaySelector)} />
        </View>
    );
};

const styles = StyleSheet.create({
    onThe: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    onTheWord: { fontSize: 13, fontFamily: FontFamily.regular },
    wrap: { gap: 10 },
    segmented: { paddingHorizontal: 14 },
    shortcuts: { flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
    shortcut: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
    everyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
    label: { fontSize: 14, fontFamily: FontFamily.regular },
    number: {
        minWidth: 52, textAlign: 'center', fontSize: 15, fontFamily: FontFamily.medium,
        borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10,
    },
    section: { gap: 10 },
    days: { flexDirection: 'row', gap: 6, paddingHorizontal: 14 },
    day: { flex: 1, aspectRatio: 1, maxHeight: 40, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14 },
    cell: { width: 36, height: 32, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
    month: { width: 52, height: 32, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
    summary: { fontSize: 13, fontFamily: FontFamily.medium, paddingHorizontal: 14, paddingTop: 2 },
});
