import { FontFamily } from '@/theme/designSystem';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccentGradient } from '@/context/AccentContext';
import { textOn } from '@/theme/tokens';
import { MatteSurface } from '@/components/ui/MatteSurface';
import Animated, {
    Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import type { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
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
                    },
                ]}
            >
                {/* The matte card, floating over the list it filters. */}
                <MatteSurface radius={24} elevation="floating" style={styles.card}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Filter</Text>
                        {active ? (
                            <Pressable accessibilityRole="button" accessibilityLabel="Reset filters" hitSlop={8}
                                onPress={() => { selectionFeedback(); props.onReset(); }}>
                                <Text style={[styles.reset, { color: colors.textSecondary }]}>Reset</Text>
                            </Pressable>
                        ) : null}
                    </View>

                    {/* Nothing chosen means everything is shown. Tap a choice to
                        narrow the list, tap it again to undo it. */}
                    <Group label="Show">
                        {(['goals_only', 'habits_only', 'tasks_only'] as const).map((id, index) => (
                            <Pill key={id} label={['Goals', 'Habits', 'Tasks'][index]} on={props.show === id}
                                onPress={() => props.onShow(props.show === id ? 'all' : id)} />
                        ))}
                    </Group>

                    <Group label="Time">
                        {(['morning', 'afternoon', 'evening'] as const).map((id, index) => (
                            <Pill key={id} label={['Morning', 'Noon', 'Evening'][index]} on={props.focus === id}
                                onPress={() => props.onFocus(props.focus === id ? 'all' : id)} />
                        ))}
                    </Group>

                    <Group label="With others">
                        <Pill label="Shared only" on={props.sharedOnly} onPress={() => props.onSharedOnly(!props.sharedOnly)} />
                    </Group>

                    {/* Sorting always has an answer; tapping the chosen one flips it. */}
                    <Group label="Sort">
                        {(['default', 'name', 'progress'] as const).map((id, index) => (
                            <Pill key={id} label={['Created', 'Name', 'Progress'][index]} on={props.order === id}
                                icon={props.order === id ? (props.direction === 1 ? 'arrow-up' : 'arrow-down') : undefined}
                                onPress={() => props.onOrder(id)} />
                        ))}
                    </Group>
                </MatteSurface>
            </Animated.View>
        </Modal>
    );
};

/** A small plain label over one row of choices. */
const Group = ({ label, children }: { label: string; children: React.ReactNode }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: colors.textTertiary }]}>{label}</Text>
            <View style={styles.pills}>{children}</View>
        </View>
    );
};

/**
 * One choice: a matte pill. Chosen, it turns solid and light with dark text,
 * the way Phantom marks its selected range — no accent colour.
 */
const Pill = ({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: 'arrow-up' | 'arrow-down' }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const { primary: chosen } = useAccentGradient();
    const ink = on ? textOn(chosen) : colors.textSecondary;
    return (
        <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}
            onPress={() => { selectionFeedback(); onPress(); }} style={styles.pillPress}>
            <MatteSurface radius={999} level="control" elevation="none" tint={on ? chosen : undefined} style={styles.pill}>
                <Text numberOfLines={1} style={[styles.pillText, { color: ink }, on && styles.pillTextOn]}>{label}</Text>
                {icon ? <Ionicons name={icon} size={12} color={ink} /> : null}
            </MatteSurface>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    panel: { position: 'absolute' },
    card: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 18, fontFamily: FontFamily.bold },
    reset: { fontSize: 14, fontFamily: FontFamily.medium },
    group: { gap: 8 },
    groupLabel: { fontSize: 12, fontFamily: FontFamily.medium },
    pills: { flexDirection: 'row', gap: 8 },
    pillPress: { flex: 1 },
    pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 8 },
    pillText: { fontSize: 13, fontFamily: FontFamily.medium },
    pillTextOn: { fontFamily: FontFamily.semibold },
});
