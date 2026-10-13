import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
    interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue,
    withTiming, type SharedValue,
} from 'react-native-reanimated';
import { Pressable } from 'react-native-gesture-handler';
import { AppIcon as Ionicons, type IconName } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

export interface SwipeAction {
    icon: IconName;
    label: string;
    color: string;
    onPress: () => void;
    /**
     * Pull past halfway and this one takes over the row; letting go there runs
     * it without a tap. Only one action per side should claim it.
     */
    destructive?: boolean;
}

interface Props {
    children: React.ReactNode;
    /** Revealed by pulling the row to the right. */
    left?: SwipeAction;
    /** Revealed by pulling the row to the left, first one nearest the row. */
    right?: SwipeAction[];
    radius?: number;
}

const MAX_SIZE = 44;
const MIN_SIZE = 30;
const GAP = 10;
/** How far past its own actions the row must be pulled to commit. */
const COMMIT_RATIO = 0.5;
const COMMIT_MIN = 130;

/**
 * How far this row has to be pulled before letting go deletes.
 *
 * Half the row, so the gesture scales with the screen, but never less than a
 * deliberate distance — on a narrow row half of it is a flick, and a flick
 * should not be able to delete anything.
 */
export const commitDistance = (rowWidth: number): number =>
    Math.max(COMMIT_MIN, rowWidth * COMMIT_RATIO);

/** Circles sit inside the row, never taller than it. */
const sizeFor = (rowHeight: number) =>
    Math.round(Math.max(MIN_SIZE, Math.min(MAX_SIZE, rowHeight - 8)));

/**
 * The swipe behind every habit and task row.
 *
 * Each action is a circle that beads out of the row's edge as you pull, the
 * way a drop of water gathers and lets go: it starts as a bump the shape of
 * the row's corner, stretches along the direction of travel, rounds off, and
 * settles with a soft neck trailing back to the row that thins out and breaks.
 * One implementation for habits and tasks, so both feel the same.
 */
export const SwipeRow: React.FC<Props> = ({ children, left, right, radius = 8 }) => {
    const { lightFeedback, mediumFeedback } = useHaptics();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const row = useRef<SwipeableMethods>(null);
    // The circles are sized from the row itself, so they fit whichever card
    // size the user has chosen instead of overflowing a compact one.
    const [height, setHeight] = useState(MAX_SIZE + 8);
    const [width, setWidth] = useState(0);
    const size = sizeFor(height);
    const slot = size + GAP;

    // Past this the destructive action takes the row over, and letting go runs
    // it. Measured from the row so a wide screen asks for a longer pull.
    const commit = commitDistance(width);
    const destructive = right?.find(action => action.destructive) ?? null;
    const armed = useSharedValue(0);
    const armedNow = useRef(false);

    /** Called from the gesture as it crosses the line, so it can be felt. */
    const setArmed = useCallback((value: boolean) => {
        if (armedNow.current === value) return;
        armedNow.current = value;
        if (value) mediumFeedback();
    }, [mediumFeedback]);

    const run = (action: SwipeAction) => {
        row.current?.close();
        action.onPress();
    };

    /** Let go past the line and the row is gone — no tap, no dialog. */
    const onWillOpen = () => {
        if (destructive && armedNow.current) {
            armedNow.current = false;
            armed.value = 0;
            row.current?.close();
            destructive.onPress();
            return;
        }
        lightFeedback();
    };

    const renderLeft = (progress: SharedValue<number>) =>
        left ? (
            <View style={[styles.side, { paddingLeft: GAP }]}>
                <Drop action={left} progress={progress} index={0} count={1} from="left" radius={radius} size={size} slot={slot} onPress={() => run(left)} />
            </View>
        ) : null;

    const renderRight = (progress: SharedValue<number>, translation: SharedValue<number>) =>
        right?.length ? (
            <RightActions
                actions={right}
                progress={progress}
                translation={translation}
                commit={destructive ? commit : Number.POSITIVE_INFINITY}
                armed={armed}
                onArmedChange={setArmed}
                radius={radius}
                size={size}
                slot={slot}
                onRun={run}
            />
        ) : null;

    return (
        <Swipeable
            ref={row}
            friction={1.6}
            overshootFriction={8}
            leftThreshold={slot * 0.5}
            rightThreshold={slot * 0.5}
            overshootLeft={false}
            overshootRight={false}
            dragOffsetFromLeftEdge={12}
            dragOffsetFromRightEdge={12}
            onSwipeableWillOpen={onWillOpen}
            onSwipeableClose={() => { armedNow.current = false; armed.value = withTiming(0, { duration: 140 }); }}
            containerStyle={[styles.container, { borderRadius: radius }]}
            renderLeftActions={left ? renderLeft : undefined}
            renderRightActions={right?.length ? renderRight : undefined}
        >
            {/* Opaque behind the row: the cards are glass, so without this the
                actions could be seen through the card as it slid over them. */}
            <View
                onLayout={(event: LayoutChangeEvent) => {
                    setHeight(event.nativeEvent.layout.height);
                    setWidth(event.nativeEvent.layout.width);
                }}
                style={{ backgroundColor: colors.background, borderRadius: radius, overflow: 'hidden' }}
            >
                {children}
            </View>
        </Swipeable>
    );
};

/**
 * The actions on the pulling side, and the moment one of them takes over.
 *
 * Up to the line this is a row of circles. Past it the destructive one swells
 * to own the row and the others get out of its way, so the row itself says
 * what letting go will do — which is why no dialog has to ask.
 */
const RightActions: React.FC<{
    actions: SwipeAction[];
    progress: SharedValue<number>;
    translation: SharedValue<number>;
    commit: number;
    armed: SharedValue<number>;
    onArmedChange: (value: boolean) => void;
    radius: number;
    size: number;
    slot: number;
    onRun: (action: SwipeAction) => void;
}> = ({ actions, progress, translation, commit, armed, onArmedChange, radius, size, slot, onRun }) => {
    useAnimatedReaction(
        () => Math.abs(translation.value) >= commit,
        (crossed, previous) => {
            if (crossed === previous) return;
            armed.value = withTiming(crossed ? 1 : 0, { duration: 160 });
            runOnJS(onArmedChange)(crossed);
        },
        [commit],
    );

    return (
        <View style={[styles.side, { paddingRight: GAP }]}>
            {actions.map((action, index) => (
                <Drop
                    key={action.label}
                    action={action}
                    progress={progress}
                    index={index}
                    count={actions.length}
                    from="right"
                    radius={radius}
                    size={size}
                    slot={slot}
                    armed={armed}
                    dominant={!!action.destructive}
                    onPress={() => onRun(action)}
                />
            ))}
        </View>
    );
};

/**
 * One action, forming out of the row's edge.
 *
 * Three things happen together, which is what sells it as liquid: the shape
 * goes from the row's own corner radius to a full circle, it stretches along
 * the drag before springing back to round, and the neck joining it to the row
 * thins and fades as it pulls free.
 */
const Drop: React.FC<{
    action: SwipeAction;
    progress: SharedValue<number>;
    index: number;
    count: number;
    from: 'left' | 'right';
    radius: number;
    size: number;
    slot: number;
    /** 0 up to the commit line, 1 past it. */
    armed?: SharedValue<number>;
    /** True for the one that takes the row over. */
    dominant?: boolean;
    onPress: () => void;
}> = ({ action, progress, index, count, from, radius, size, slot, armed, dominant, onPress }) => {
    // The nearest action forms first; the others follow it out. `start` is a
    // plain number, so the worklets below can read it without calling back
    // into JavaScript, which the UI thread cannot do synchronously.
    const start = (index / count) * 0.4;

    const dropStyle = useAnimatedStyle(() => {
        const t = Math.min(1, Math.max(0, (progress.value - start) / (1 - start)));
        // Round by the time it is halfway out, so it reads as a circle for most
        // of the drag rather than only at the very end.
        const round = interpolate(t, [0, 0.45], [radius, size / 2], 'clamp');
        // Stretches along the pull, then settles: the moment a drop separates.
        const stretch = interpolate(t, [0, 0.5, 0.75, 1], [1.3, 1.1, 0.98, 1]);
        const squash = interpolate(t, [0, 0.5, 0.75, 1], [0.7, 0.95, 1.02, 1]);
        // Past the line the destructive one swells and the rest withdraw, so
        // the row shows what letting go means before it happens.
        const take = armed ? armed.value : 0;
        const claim = dominant ? take : 0;
        const yield_ = dominant ? 0 : take;

        return {
            opacity: interpolate(t, [0, 0.15, 0.45], [0, 0.7, 1], 'clamp') * (1 - yield_ * 0.85),
            borderRadius: round,
            transform: [
                { translateX: interpolate(t, [0, 1], [from === 'left' ? -slot * 0.6 : slot * 0.6, 0]) + yield_ * slot * 0.5 },
                { scaleX: stretch },
                { scaleY: squash },
                { scale: interpolate(t, [0, 0.6, 1], [0.78, 1.02, 1]) * (1 + claim * 0.35) * (1 - yield_ * 0.4) },
            ],
        };
    });

    const neckStyle = useAnimatedStyle(() => {
        const t = Math.min(1, Math.max(0, (progress.value - start) / (1 - start)));
        return {
            // Thins out and snaps: gone by the time the circle is free.
            opacity: interpolate(t, [0, 0.25, 0.75, 1], [0, 0.9, 0.35, 0]),
            transform: [
                { scaleY: interpolate(t, [0, 0.5, 1], [0.9, 0.5, 0.15]) },
                { scaleX: interpolate(t, [0, 1], [1, 0.5]) },
            ],
        };
    });

    return (
        <View style={[styles.slot, { width: size, height: size, marginHorizontal: GAP / 2 }]}>
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.neck,
                    { height: size * 0.62, backgroundColor: action.color },
                    from === 'left' ? { left: -GAP / 2 } : { right: -GAP / 2 },
                    neckStyle,
                ]}
            />
            <Animated.View style={[styles.drop, { width: size, height: size, backgroundColor: action.color }, dropStyle]}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    onPress={onPress}
                    style={styles.press}
                >
                    <Ionicons name={action.icon} size={Math.round(size * 0.44)} color="#fff" />
                </Pressable>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    // Clipped: a dragged row must never slide out past its own card bounds.
    container: { overflow: 'hidden', marginBottom: 4 },
    side: { flexDirection: 'row', alignItems: 'center' },
    slot: { alignItems: 'center', justifyContent: 'center' },
    drop: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    neck: { position: 'absolute', width: GAP * 2, borderRadius: GAP },
    press: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
});
