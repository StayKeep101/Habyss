import { FontFamily } from '@/theme/designSystem';
import { GOALS_ENABLED } from '@/constants/features';
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Overlay } from '@/components/ui/Overlay';
import { useAccentGradient } from '@/context/AccentContext';
import { textOn } from '@/theme/tokens';
import { MatteSurface } from '@/components/ui/MatteSurface';
import Animated, {
    interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import type { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { OVERLAY } from '@/theme/motion';
import { useHaptics } from '@/hooks/useHaptics';

type Kind = 'goals' | 'habits' | 'tasks';
type Focus = 'all' | 'morning' | 'afternoon' | 'evening';
type Order = 'default' | 'name' | 'progress' | 'priority';
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
    /** Friends you share something with, to show only what you share with one of them. */
    friends?: { id: string; name: string }[];
    sharedWith?: string | null; onSharedWith?: (id: string | null) => void;
    order: Order; direction: 1 | -1; onOrder: (value: Order) => void; onReset: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Every overlay opens and closes the same way (theme/motion.ts), Reduce Motion included.
const OPEN = OVERLAY.in;
const CLOSE = OVERLAY.out;

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
                            {(['goals', 'habits', 'tasks'] as const).filter(kind => kind !== 'goals' || GOALS_ENABLED).map(kind => (
                                <Pill key={kind} label={{ goals: 'Goals', habits: 'Habits', tasks: 'Tasks' }[kind]} on={props.shown[kind]}
                                    onPress={() => props.onToggleShown(kind)} />
                            ))}
                        </Group>

                        {/* Shared: everything you share, or only what you share with one friend. */}
                        <Group label="Shared" scroll>
                            <Pill label="All shared" on={props.sharedOnly && !props.sharedWith}
                                onPress={() => { props.onSharedWith?.(null); props.onSharedOnly(!(props.sharedOnly && !props.sharedWith)); }} />
                            {(props.friends ?? []).map(friend => (
                                <Pill key={friend.id} label={friend.name} on={props.sharedOnly && props.sharedWith === friend.id}
                                    onPress={() => {
                                        const on = props.sharedOnly && props.sharedWith === friend.id;
                                        props.onSharedWith?.(on ? null : friend.id);
                                        props.onSharedOnly(!on);
                                    }} />
                            ))}
                        </Group>

                        {/* Sorting always has an answer; tapping the chosen one flips it. */}
                        <Group label="Sort" scroll>
                            {(['default', 'name', 'progress', 'priority'] as const).map((id, index) => (
                                <Pill key={id} label={['Created', 'Name', 'Progress', 'Priority'][index]} on={props.order === id}
                                    icon={props.order === id ? (props.direction === 1 ? 'arrow-up' : 'arrow-down') : undefined}
                                    onPress={() => props.onOrder(id)} fit />
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
const Group = ({ label, children, scroll }: { label: string; children: React.ReactNode;
    /** Choices sized to their words, sliding sideways, for a row with more than fits (Sort, at larger text sizes). */
    scroll?: boolean }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: colors.textTertiary }]}>{label}</Text>
            {scroll ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pills} contentContainerStyle={styles.pillsFit}>{children}</ScrollView>
            ) : <View style={styles.pills}>{children}</View>}
        </View>
    );
};

/**
 * One choice: a matte pill. Chosen, it turns solid and light with dark text,
 * the way Phantom marks its selected range — no accent colour.
 */
const Pill = ({ label, on, onPress, icon, fit }: { label: string; on: boolean; onPress: () => void; icon?: 'arrow-up' | 'arrow-down';
    /** As wide as its words (in a sliding row), not a share of the row. */
    fit?: boolean }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const { primary: chosen } = useAccentGradient();
    const ink = on ? textOn(chosen) : colors.textSecondary;
    return (
        <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}
            onPress={() => { selectionFeedback(); onPress(); }} style={fit ? null : styles.pillPress}>
            <MatteSurface radius={999} level="control" elevation="none" tint={on ? chosen : undefined} style={[styles.pill, fit && styles.pillFit]}>
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
    pillsFit: { flexDirection: 'row', gap: 6 },
    pillPress: { flex: 1 },
    pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 7, paddingHorizontal: 6 },
    pillText: { fontSize: 12, fontFamily: FontFamily.medium },
    pillTextOn: { fontFamily: FontFamily.semibold },
    pillFit: { paddingHorizontal: 12 },
});
