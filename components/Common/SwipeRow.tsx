import React, { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Pressable } from 'react-native-gesture-handler';
import { AppIcon as Ionicons, type IconName } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';

export interface SwipeAction {
    icon: IconName;
    label: string;
    color: string;
    onPress: () => void;
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
    const { lightFeedback } = useHaptics();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const row = useRef<SwipeableMethods>(null);
    // The circles are sized from the row itself, so they fit whichever card
    // size the user has chosen instead of overflowing a compact one.
    const [height, setHeight] = useState(MAX_SIZE + 8);
    const size = sizeFor(height);
    const slot = size + GAP;

    const run = (action: SwipeAction) => {
        row.current?.close();
        action.onPress();
    };

    const renderLeft = (progress: SharedValue<number>) =>
        left ? (
            <View style={[styles.side, { paddingLeft: GAP }]}>
                <Drop action={left} progress={progress} index={0} count={1} from="left" radius={radius} size={size} slot={slot} onPress={() => run(left)} />
            </View>
        ) : null;

    const renderRight = (progress: SharedValue<number>) =>
        right?.length ? (
            <View style={[styles.side, { paddingRight: GAP }]}>
                {right.map((action, index) => (
                    <Drop
                        key={action.label}
                        action={action}
                        progress={progress}
                        index={index}
                        count={right.length}
                        from="right"
                        radius={radius}
                        size={size}
                        slot={slot}
                        onPress={() => run(action)}
                    />
                ))}
            </View>
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
            onSwipeableWillOpen={() => lightFeedback()}
            containerStyle={[styles.container, { borderRadius: radius }]}
            renderLeftActions={left ? renderLeft : undefined}
            renderRightActions={right?.length ? renderRight : undefined}
        >
            {/* Opaque behind the row: the cards are glass, so without this the
                actions could be seen through the card as it slid over them. */}
            <View
                onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
                style={{ backgroundColor: colors.background, borderRadius: radius, overflow: 'hidden' }}
            >
                {children}
            </View>
        </Swipeable>
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
    onPress: () => void;
}> = ({ action, progress, index, count, from, radius, size, slot, onPress }) => {
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
        return {
            opacity: interpolate(t, [0, 0.15, 0.45], [0, 0.7, 1], 'clamp'),
            borderRadius: round,
            transform: [
                { translateX: interpolate(t, [0, 1], [from === 'left' ? -slot * 0.6 : slot * 0.6, 0]) },
                { scaleX: stretch },
                { scaleY: squash },
                { scale: interpolate(t, [0, 0.6, 1], [0.78, 1.02, 1]) },
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
