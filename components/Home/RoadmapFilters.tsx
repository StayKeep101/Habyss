import { FontFamily } from '@/theme/designSystem';
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Overlay } from '@/components/ui/Overlay';
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

type Kind = 'goals' | 'habits' | 'tasks';
type Focus = 'all' | 'morning' | 'afternoon' | 'evening';
type Order = 'default' | 'name' | 'progress';
type View_ = 'timeline' | 'list';

/** Where the filter button is, so the menu can drop out of it. */
export interface FilterAnchor { x: number; y: number; width: number; height: number }

interface Props {
    visible: boolean; onClose: () => void; goals: Habit[];
    /** The day as a timeline, or as lists. */
    view: View_; onView: (value: View_) => void;
    anchor?: FilterAnchor | null;
    /** Goals, habits and tasks, each on or off (at least one stays on). */
    shown: Record<Kind, boolean>; onToggleShown: (kind: Kind) => void;
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
 * The roadmap's filters, as a small menu rather than a page.
 *
 * Filtering is a small decision, so it gets a small card: one row per
 * question, a short label and compact pills beside it, no title. It drops out
 * of the button that opened it and closes when you tap away. What it is set
 * to is remembered between launches (lib/roadmapFilter.ts).
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
    // Only as wide as its pills need, not the width of the screen.
    const width = Math.min(340, screen.width - margin * 2);
    // Centred under what it drops from, so it always opens in the same place.
    const left = anchor ? Math.min(screen.width - margin - width, Math.max(margin, anchor.x + anchor.width / 2 - width / 2)) : (screen.width - width) / 2;

    const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.55 }));
    const panel = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [
            { translateY: interpolate(progress.value, [0, 1], [-14, 0]) },
            { scaleY: interpolate(progress.value, [0, 1], [0.9, 1]) },
            { scaleX: interpolate(progress.value, [0, 1], [0.96, 1]) },
        ],
    }));

    const active = !props.shown.goals || !props.shown.habits || !props.shown.tasks || props.focus !== 'all' || !!props.goal
        || props.order !== 'default' || props.sharedOnly;
    const close = () => { lightFeedback(); props.onClose(); };

    if (!mounted) return null;

    return (
        // Drawn over the page, not a second window: opening one as the list
        // came back from a pull blanked the whole page for a moment.
        <Overlay onRequestClose={close}>
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
                        left,
                        width,
                        // Grows out of the button, not the middle of the screen.
                        transformOrigin: anchor ? `${Math.min(width, Math.max(0, anchor.x - left + anchor.width / 2))}px 0px` : 'top center',
                    },
                ]}
            >
                {/* The matte card, floating over the list it filters. */}
                <MatteSurface radius={20} elevation="floating" style={styles.card}>
                    {/* How the day is shown: not a filter, so Reset leaves it. */}
                    <Group label="View">
                        {(['timeline', 'list'] as const).map((id, index) => (
                            <Pill key={id} label={['Timeline', 'List'][index]} on={props.view === id} onPress={() => props.onView(id)} />
                        ))}
                    </Group>

                    {/* The timeline is the whole day in time order: what to show,
                        when, and in what order only mean something in the list. */}
                    {props.view === 'list' ? (<>
                        {/* Each kind is a switch: lit means shown. */}
                        <Group label="Show">
                            {(['goals', 'habits', 'tasks'] as const).map((kind, index) => (
                                <Pill key={kind} label={['Goals', 'Habits', 'Tasks'][index]} on={props.shown[kind]}
                                    onPress={() => props.onToggleShown(kind)} />
                            ))}
                        </Group>

                        <Group label="Time">
                            {(['morning', 'afternoon', 'evening'] as const).map((id, index) => (
                                <Pill key={id} label={['Morning', 'Noon', 'Evening'][index]} on={props.focus === id}
                                    onPress={() => props.onFocus(props.focus === id ? 'all' : id)} />
                            ))}
                        </Group>

                        <Group label="Shared">
                            <Pill label="Only shared" on={props.sharedOnly} onPress={() => props.onSharedOnly(!props.sharedOnly)} />
                        </Group>

                        {/* Sorting always has an answer; tapping the chosen one flips it. */}
                        <Group label="Sort">
                            {(['default', 'name', 'progress'] as const).map((id, index) => (
                                <Pill key={id} label={['Created', 'Name', 'Progress'][index]} on={props.order === id}
                                    icon={props.order === id ? (props.direction === 1 ? 'arrow-up' : 'arrow-down') : undefined}
                                    onPress={() => props.onOrder(id)} />
                            ))}
                        </Group>

                        {active ? (
                            <Pressable accessibilityRole="button" accessibilityLabel="Reset filters" hitSlop={8} style={styles.resetWrap}
                                onPress={() => { selectionFeedback(); props.onReset(); }}>
                                <Text style={[styles.reset, { color: colors.textTertiary }]}>Reset</Text>
                            </Pressable>
                        ) : null}
                    </>) : null}
                </MatteSurface>
            </Animated.View>
        </Overlay>
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
    card: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
    resetWrap: { alignSelf: 'flex-end', marginTop: -2 },
    reset: { fontSize: 12, fontFamily: FontFamily.medium },
    group: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    groupLabel: { width: 50, fontSize: 12, fontFamily: FontFamily.medium },
    pills: { flex: 1, flexDirection: 'row', gap: 6 },
    pillPress: { flex: 1 },
    pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 7, paddingHorizontal: 6 },
    pillText: { fontSize: 12, fontFamily: FontFamily.medium },
    pillTextOn: { fontFamily: FontFamily.semibold },
});
