import { FontFamily } from '@/constants/DesignSystem';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import type { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';

type Show = 'all' | 'goals_only' | 'habits_only' | 'tasks_only';
type Focus = 'all' | 'morning' | 'afternoon' | 'evening';
type Order = 'default' | 'name' | 'progress';

/** Where the filter button is, so the menu can drop out of it. */
export interface FilterAnchor { x: number; y: number; width: number; height: number }

interface Props {
    visible: boolean; onClose: () => void; goals: Habit[];
    anchor?: FilterAnchor | null;
    show: Show; onShow: (value: Show) => void;
    focus: Focus; onFocus: (value: Focus) => void;
    goal: string | null; onGoal: (value: string | null) => void;
    /** Only the habits, tasks and goals somebody else is on too. */
    sharedOnly: boolean; onSharedOnly: (value: boolean) => void;
    order: Order; direction: 1 | -1; onOrder: (value: Order) => void; onReset: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const OPEN = { duration: 220, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 150, easing: Easing.in(Easing.cubic) };

/**
 * The roadmap's filters, as a menu rather than a page.
 *
 * Filtering is a small decision, so it does not deserve a full sheet from the
 * bottom: it drops out of the button that opened it, shows every choice at
 * once in four rows, and closes when you tap away. The selected option is one
 * pill that slides between choices, which is what makes a segmented control
 * read as a single control rather than a row of buttons.
 */
export const RoadmapFilters = (props: Props) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();

    const [mounted, setMounted] = useState(props.visible);
    const progress = useSharedValue(0);

    // Mounted as soon as it is asked for, and unmounted by the closing
    // animation itself, so the menu is never cut off mid-exit.
    if (props.visible && !mounted) setMounted(true);

    useEffect(() => {
        if (props.visible) {
            progress.value = withTiming(1, OPEN);
            return;
        }
        progress.value = withTiming(0, CLOSE, finished => {
            if (finished) runOnJS(setMounted)(false);
        });
    }, [props.visible]);

    const screen = Dimensions.get('window');
    const anchor = props.anchor;
    const top = anchor ? anchor.y + anchor.height + 8 : 96;
    const margin = 12;

    const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.55 }));
    const panel = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [
            { translateY: interpolate(progress.value, [0, 1], [-14, 0]) },
            { scaleY: interpolate(progress.value, [0, 1], [0.9, 1]) },
            { scaleX: interpolate(progress.value, [0, 1], [0.96, 1]) },
        ],
    }));

    const active = props.show !== 'all' || props.focus !== 'all' || !!props.goal
        || props.order !== 'default' || props.sharedOnly;
    const close = () => { lightFeedback(); props.onClose(); };

    if (!mounted) return null;

    return (
        <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
            <AnimatedPressable
                testID="filter-scrim"
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={close}
                style={[StyleSheet.absoluteFill, scrim, { backgroundColor: '#000' }]}
            />

            <Animated.View
                accessibilityViewIsModal
                style={[
                    styles.panel,
                    panel,
                    {
                        top,
                        left: margin,
                        width: screen.width - margin * 2,
                        // Grows out of the button, not the middle of the screen.
                        transformOrigin: anchor ? `${Math.min(screen.width - margin * 2, Math.max(0, anchor.x - margin + anchor.width / 2))}px 0px` : 'top center',
                        borderColor: colors.border,
                        backgroundColor: isLight ? 'rgba(255,255,255,0.94)' : 'rgba(16,19,24,0.94)',
                    },
                ]}
            >
                <BlurView intensity={isLight ? 30 : 50} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />

                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Filter</Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Reset filters"
                        disabled={!active}
                        onPress={() => { selectionFeedback(); props.onReset(); }}
                        hitSlop={8}
                    >
                        <Text style={[styles.reset, { color: active ? primary : colors.textTertiary }]}>Reset</Text>
                    </Pressable>
                </View>

                {/* No "All", no "Any", no "Any goal".
                    Every one of these sections had a first option meaning "do
                    not filter", which is what the section already means when
                    nothing in it is chosen — a whole segment, in every row, to
                    say nothing. Choosing the thing that is already chosen turns
                    it off instead, and that is a rule worth having once rather
                    than a word under every control explaining it. */}
                <Row label="Show">
                    <Segmented
                        options={[
                            { id: 'goals_only', label: 'Goals' },
                            { id: 'habits_only', label: 'Habits' },
                            { id: 'tasks_only', label: 'Tasks' },
                        ]}
                        value={props.show}
                        onChange={value => props.onShow((value ?? 'all') as Show)}
                        clearable
                        primary={primary}
                        colors={colors}
                    />
                </Row>

                <Row label="Time">
                    <Segmented
                        options={[
                            { id: 'morning', label: 'Morning' },
                            { id: 'afternoon', label: 'Noon' },
                            { id: 'evening', label: 'Evening' },
                        ]}
                        value={props.focus}
                        onChange={value => props.onFocus((value ?? 'all') as Focus)}
                        clearable
                        primary={primary}
                        colors={colors}
                    />
                </Row>

                {/* One toggle rather than a two-option switch: "Everything" was
                    a segment whose only job was to be the other one's opposite. */}
                <Row label="Shared">
                    <Chip
                        label="Shared with someone"
                        selected={props.sharedOnly}
                        onPress={() => props.onSharedOnly(!props.sharedOnly)}
                        primary={primary}
                        colors={colors}
                    />
                </Row>

                {props.goals.length > 0 ? (
                    <Row label="Goal">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                            {props.goals.map(goal => (
                                <Chip
                                    key={goal.id}
                                    label={goal.name}
                                    selected={props.goal === goal.id}
                                    onPress={() => props.onGoal(props.goal === goal.id ? null : goal.id)}
                                    primary={primary}
                                    colors={colors}
                                />
                            ))}
                        </ScrollView>
                    </Row>
                ) : null}

                {/* Sort keeps every option: there is no "unsorted" list, so
                    tapping the chosen one reverses it rather than clearing it.
                    The arrow beside it says so without a line of text. */}
                <Row label="Sort">
                    <Segmented
                        options={[
                            { id: 'default', label: 'Created' },
                            { id: 'name', label: 'Name' },
                            { id: 'progress', label: 'Progress' },
                        ]}
                        value={props.order}
                        onChange={value => props.onOrder(value as Order)}
                        primary={primary}
                        colors={colors}
                        trailingIcon={props.direction === 1 ? 'arrow-up' : 'arrow-down'}
                    />
                </Row>
            </Animated.View>
        </Modal>
    );
};

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <View style={styles.row}>
            <View style={styles.rowHead}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label.toUpperCase()}</Text>
                {hint ? <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text> : null}
            </View>
            {children}
        </View>
    );
};

/** One pill that slides between the options, rather than buttons lighting up. */
const Segmented = ({ options, value, onChange, primary, colors, trailingIcon, clearable }: {
    options: { id: string; label: string }[];
    value: string;
    onChange: (id: string | null) => void;
    primary: string;
    colors: typeof Colors.light;
    trailingIcon?: 'arrow-up' | 'arrow-down';
    /**
     * Whether choosing what is already chosen turns it off.
     *
     * The alternative was a first option in every row meaning "do not filter",
     * which is a whole segment spent saying nothing — and it is what the row
     * already means when none of them is on.
     */
    clearable?: boolean;
}) => {
    const { selectionFeedback } = useHaptics();
    const [width, setWidth] = useState(0);
    const found = options.findIndex(option => option.id === value);
    // -1 is a real answer on a clearable row: nothing is chosen, and the pill
    // has nowhere to be. It stays where it was and fades, rather than sliding
    // back to the first option as though that had been picked.
    const index = Math.max(0, found);
    const position = useSharedValue(index);
    const chosen = found >= 0;
    const shown = useSharedValue(chosen ? 1 : 0);

    useEffect(() => {
        position.value = withSpring(index, { damping: 18, stiffness: 240, mass: 0.6 });
    }, [index]);
    useEffect(() => {
        shown.value = withTiming(chosen ? 1 : 0, { duration: 140 });
    }, [chosen]);

    const slot = width ? (width - 6) / options.length : 0;
    const pill = useAnimatedStyle(() => ({
        width: slot,
        opacity: shown.value,
        transform: [{ translateX: position.value * slot }, { scale: 0.94 + shown.value * 0.06 }],
    }));

    return (
        <View
            onLayout={event => setWidth(event.nativeEvent.layout.width)}
            style={[styles.segmented, { backgroundColor: colors.surfaceSecondary }]}
        >
            {slot > 0 ? <Animated.View style={[styles.pill, pill, { backgroundColor: primary + '26', borderColor: primary + '55' }]} /> : null}
            {options.map(option => {
                const selected = option.id === value;
                return (
                    <Pressable
                        key={option.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => {
                            selectionFeedback();
                            onChange(clearable && selected ? null : option.id);
                        }}
                        style={styles.segment}
                    >
                        <Text numberOfLines={1} style={[styles.segmentText, { color: selected ? primary : colors.textSecondary }]}>
                            {option.label}
                        </Text>
                        {selected && trailingIcon ? <Ionicons name={trailingIcon} size={12} color={primary} /> : null}
                    </Pressable>
                );
            })}
        </View>
    );
};

const Chip = ({ label, selected, onPress, primary, colors }: {
    label: string; selected: boolean; onPress: () => void; primary: string; colors: typeof Colors.light;
}) => {
    const { selectionFeedback } = useHaptics();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => { selectionFeedback(); onPress(); }}
            style={[styles.chip, {
                backgroundColor: selected ? primary + '20' : colors.surfaceSecondary,
                borderColor: selected ? primary + '66' : 'transparent',
            }]}
        >
            <Text numberOfLines={1} style={[styles.chipText, { color: selected ? primary : colors.textSecondary }]}>{label}</Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    panel: {
        position: 'absolute', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
        // Tight on purpose: this panel covers the list it is filtering, so
        // every point it takes is a row of that list you cannot see while
        // deciding. The labels are what carry the structure, not the gaps.
        paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 9,
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 15, fontFamily: FontFamily.semibold },
    reset: { fontSize: 13, fontFamily: FontFamily.medium },
    row: { gap: 5 },
    rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowLabel: { fontSize: 10, letterSpacing: 1.1, fontFamily: FontFamily.medium },
    hint: { fontSize: 10, fontFamily: FontFamily.regular },
    segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
    pill: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 9, borderWidth: 1 },
    segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7 },
    segmentText: { fontSize: 12, fontFamily: FontFamily.medium },
    chips: { gap: 6, paddingRight: 4 },
    chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, maxWidth: 170 },
    chipText: { fontSize: 12, fontFamily: FontFamily.medium },
});
