import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { textOn } from '@/theme/tokens';
import { ChoicePill } from '@/components/ui/ChoicePill';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { Choices, usePanelRoom } from '@/components/Create/DetailBar';
import { Wheel } from '@/components/ui/Wheel';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import {
    DAILY, WEEKDAYS, WEEKDAYS_ONLY, WEEKENDS_ONLY, WEEKDAY_NAME,
    type DaySelector, type Ordinal, type Recurrence, type Weekday,
} from '@/lib/recurrence';

/** Timed, never sprung: the panel changes height and a spring would bounce it. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

type Preset = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly' | 'hourly' | 'quota';
type Kind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'hourly' | 'quota';

/** The kinds of rule, as a segmented control: all of them visible, one tap each. */
const KINDS: { id: Kind; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
    { id: 'hourly', label: 'Hourly' },
    // "3 times a week, any days".
    { id: 'quota', label: 'Flexible' },
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
    if (rule.kind === 'quota') return 'quota';
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
        case 'quota':
            return current.kind === 'quota' ? current : { kind: 'quota', every: 1, times: 3, period: 'week' };
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
 * How often ("every 2 weeks") is a wheel, like every number set in the app,
 * and the grids take their size from the room the panel has, so a monthly
 * or yearly rule is fully on screen on a small phone too. The closed chip
 * reads the rule back in words.
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
    const room = usePanelRoom();

    const preset = presetOf(value);
    const every = 'every' in value ? value.every : 1;
    const unitWord = value.kind === 'hourly' ? 'hours' : value.kind === 'daily' ? 'days'
        : value.kind === 'weekly' ? 'weeks' : value.kind === 'monthly' ? 'months' : 'years';

    // Hourly stops at 23: every 24 hours is daily. Nothing repeats every 0.
    const maxEvery = value.kind === 'hourly' ? 23 : value.kind === 'daily' ? 30 : value.kind === 'weekly' ? 12 : value.kind === 'monthly' ? 12 : 10;
    const everyOptions = Array.from({ length: maxEvery }, (_, index) => ({ id: index + 1, label: String(index + 1) }));
    const setEvery = (next: number) => onChange({ ...value, every: next });
    // The month grid's rows share what is left of the panel after the controls above it.
    const cellHeight = Math.max(26, Math.min(38, Math.floor((room - 36 - 96 - 40 - 30) / 5)));

    const toggle = <T,>(list: T[], item: T): T[] =>
        list.includes(item) ? list.filter(one => one !== item) : [...list, item];

    return (
        <Animated.View layout={MORPH} style={styles.wrap}>
            {/* Every kind in one row that scrolls sideways, each word whole
                (six squeezed into the width read "D…", "W…"). Weekdays and
                weekends are weekly rules, so they live under Weekly as one-tap
                shortcuts beside the days themselves. */}
            <Choices
                oneLine
                options={KINDS}
                value={(preset === 'weekdays' || preset === 'weekends' ? 'weekly' : preset) as Kind}
                accent={accent}
                onChange={kind => onChange(ruleForPreset(kind, value))}
            />

            {/* "Every N ___" — only where an interval means anything. */}
            {preset !== 'weekdays' && preset !== 'weekends' && preset !== 'quota' ? (
                <Animated.View layout={MORPH} style={styles.everyRow}>
                    <Text style={[styles.everyWord, styles.right, { color: colors.textPrimary }]}>Every</Text>
                    <View style={styles.everyWheel}>
                        <Wheel testID="repeat-every" options={everyOptions} value={Math.min(every, maxEvery)} onChange={setEvery} rowHeight={40} style={styles.everyDigit} />
                    </View>
                    <Text style={[styles.everyWord, { color: colors.textPrimary }]}>{every === 1 ? unitWord.replace(/s$/, '') : unitWord}</Text>
                </Animated.View>
            ) : null}

            {/* Flexible: so many times a week or a month, on whichever days. */}
            {value.kind === 'quota' ? (
                <Animated.View layout={MORPH} entering={FadeIn.duration(180)} style={styles.section}>
                    <View style={styles.everyRow}>
                        <View style={styles.everyWheel}>
                            <Wheel testID="repeat-times" options={Array.from({ length: value.period === 'week' ? 7 : 31 }, (_, index) => ({ id: index + 1, label: String(index + 1) }))}
                                value={Math.min(value.times, value.period === 'week' ? 7 : 31)} onChange={times => onChange({ ...value, times })} rowHeight={32} style={styles.everyDigit} />
                        </View>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{value.times === 1 ? 'time a' : 'times a'}</Text>
                    </View>
                    <Choices options={[{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} value={value.period} accent={accent}
                        onChange={period => onChange({ ...value, period: period as 'week' | 'month', times: period === 'week' ? Math.min(value.times, 7) : value.times })} />
                    <Text style={[styles.label, { color: colors.textTertiary }]}>Any days you like. A day only counts as missed when there aren't enough days left.</Text>
                </Animated.View>
            ) : null}

            {/* Weekly: which days of the week, with the two common sets a tap away. */}
            {value.kind === 'weekly' ? (
                <View style={styles.shortcuts}>
                    {(['weekdays', 'weekends'] as const).map(id => {
                        const on = preset === id;
                        return (
                            <ChoicePill key={id} role="button" label={id === 'weekdays' ? 'Weekdays' : 'Weekends'} on={on} color={accent}
                                onPress={() => { lightFeedback(); onChange(ruleForPreset(id, value)); }} />
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
                                        style={[styles.cell, { height: cellHeight }]}
                                    >
                                        <MatteSurface radius={10} level="control" elevation="none" tint={on ? accent : undefined} style={styles.cellFill}>
                                            <Text style={{ color: on ? textOn(accent) : colors.textSecondary, fontSize: 12, fontFamily: FontFamily.medium }}>{date}</Text>
                                        </MatteSurface>
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
                                    style={[styles.month, { height: cellHeight }]}
                                >
                                    <MatteSurface radius={10} level="control" elevation="none" tint={on ? accent : undefined} style={styles.cellFill}>
                                        <Text style={{ color: on ? textOn(accent) : colors.textSecondary, fontSize: 12, fontFamily: FontFamily.medium }}>{name}</Text>
                                    </MatteSurface>
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
    shortcuts: { flexDirection: 'row', gap: 8 },
    shortcut: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
    /** "Every 2 weeks", centred and read as one sentence. */
    everyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 4 },
    everyWheel: { width: 76 },
    everyDigit: { fontSize: 22, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    everyWord: { fontSize: 17, fontFamily: FontFamily.medium, minWidth: 64 },
    label: { fontSize: 14, fontFamily: FontFamily.regular },
    right: { textAlign: 'right' },
    number: {
        minWidth: 52, textAlign: 'center', fontSize: 15, fontFamily: FontFamily.medium,
        borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10,
    },
    section: { gap: 10 },
    days: { flexDirection: 'row', gap: 6 },
    day: { flex: 1, aspectRatio: 1, maxHeight: 40, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
    // Seven across and four across, filling the width: no ragged right edge.
    cell: { width: '14.2857%', height: 32, padding: 3 },
    month: { width: '25%', height: 32, padding: 3 },
    cellFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
