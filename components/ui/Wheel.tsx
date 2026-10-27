import React, { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Pressable, StyleSheet, View, type ViewStyle, type NativeScrollEvent, type NativeSyntheticEvent, type TextStyle } from 'react-native';
import Animated, {
    Extrapolation, interpolate, runOnJS, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle,
    useSharedValue, type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { MatteSurface } from './MatteSurface';

/** 44 pt: a row is tappable, so it gets a full touch target. */
export const WHEEL_ROW = 44;

export interface WheelOption<T> {
    id: T;
    label: string;
}

/**
 * One choice at a time, turned rather than tapped — the iPhone picker.
 *
 * Rows ease out of the middle as you turn: smaller, fainter and tilted away,
 * worked out on the UI thread every frame so it keeps up with the finger. A
 * light tick each time a row crosses the middle. The answer is reported once,
 * when the wheel comes to rest, never half-way through a flick; reporting on
 * finger-up used to hand the page a value the wheel was still moving past, the
 * page scrolled the wheel back to it, and the two fought.
 *
 * Tappable as well as turnable, which is what a UIPickerView does and the only
 * way a screen reader can reach a row. Touching it puts the keyboard away, so
 * a wheel under a text field is never half hidden while you turn it.
 *
 * Wheels side by side (a date, a time) share one band across them, as on
 * iOS: the group draws `WheelBand` once and each wheel passes `band={false}`.
 */
export function Wheel<T extends string | number>({ options, value, onChange, visible = 3, style, testID, rowHeight = WHEEL_ROW, band = true }: {
    options: WheelOption<T>[];
    value: T;
    onChange: (id: T) => void;
    /** How many rows are on screen. Odd, so one is in the middle. */
    visible?: 3 | 5;
    style?: TextStyle;
    testID?: string;
    /** Row height; smaller where a panel is tight. */
    rowHeight?: number;
    /** Its own selection band; off when a group draws one across all its wheels. */
    band?: boolean;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme] ?? Colors.abyss;
    const { selectionFeedback } = useHaptics();
    const ref = useAnimatedRef<Animated.ScrollView>();
    const index = Math.max(0, options.findIndex(option => option.id === value));
    const height = rowHeight * visible;
    const pad = (height - rowHeight) / 2;

    const offset = useSharedValue(index * rowHeight);
    const centred = useSharedValue(index);
    /** Where the wheel opens. Read once: handing the scroll view a new offset
     *  on every render can snap it back to the old value mid-turn. */
    const initial = useRef({ x: 0, y: index * rowHeight }).current;
    /** The row the wheel last settled on (or was told to show). */
    const settled = useRef(index);
    const touching = useRef(false);
    const lastY = useRef(index * rowHeight);
    const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

    // The value changed from outside (another control, a reset): turn to it,
    // unless the finger is on the wheel — then the finger wins.
    useEffect(() => {
        if (touching.current || settled.current === index) return;
        settled.current = index;
        ref.current?.scrollTo({ y: index * rowHeight, animated: true });
    }, [index, ref]);

    const tick = useCallback(() => selectionFeedback(), [selectionFeedback]);
    const track = useCallback((y: number) => { lastY.current = y; }, []);

    const onScroll = useAnimatedScrollHandler({
        onScroll: event => {
            offset.value = event.contentOffset.y;
            runOnJS(track)(event.contentOffset.y);
            const row = Math.min(options.length - 1, Math.max(0, Math.round(event.contentOffset.y / rowHeight)));
            if (row !== centred.value) {
                centred.value = row;
                runOnJS(tick)();
            }
        },
    });

    /**
     * Report the row in the middle once the wheel has truly stopped — the way
     * a UIPickerView only changes its value at rest. Every "it ended" event
     * (finger up, momentum over) just restarts a short timer; any further
     * movement cancels it. So a flick, a slow drag and a drag that ends with a
     * snap all land on the row you can see, never on one it passed.
     */
    const settleSoon = useCallback(() => {
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
            settleTimer.current = null;
            touching.current = false;
            const row = Math.min(options.length - 1, Math.max(0, Math.round(lastY.current / rowHeight)));
            if (Math.abs(lastY.current - row * rowHeight) > 1) {
                ref.current?.scrollTo({ y: row * rowHeight, animated: true });
            }
            if (row === settled.current) return;
            settled.current = row;
            onChange(options[row].id);
        }, 90);
    }, [options, onChange, ref]);

    const onBegin = useCallback(() => {
        Keyboard.dismiss();
        touching.current = true;
        if (settleTimer.current) { clearTimeout(settleTimer.current); settleTimer.current = null; }
    }, []);

    const onEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        lastY.current = event.nativeEvent.contentOffset.y;
        settleSoon();
    }, [settleSoon]);

    /** A tap on a row turns it to the middle and chooses it, as on iOS. */
    const choose = useCallback((position: number) => {
        Keyboard.dismiss();
        if (settleTimer.current) { clearTimeout(settleTimer.current); settleTimer.current = null; }
        touching.current = false;
        lastY.current = position * rowHeight;
        ref.current?.scrollTo({ y: position * rowHeight, animated: true });
        if (position === settled.current) return;
        settled.current = position;
        onChange(options[position].id);
    }, [options, onChange, ref]);

    return (
        <View style={[styles.frame, { height }]} testID={testID}>
            {/* The window, behind the rows: the matte surface, no outline. */}
            {band ? <WheelBand rowHeight={rowHeight} visible={visible} /> : null}

            <Animated.ScrollView
                ref={ref}
                showsVerticalScrollIndicator={false}
                snapToInterval={rowHeight}
                decelerationRate="fast"
                contentOffset={initial}
                contentContainerStyle={{ paddingVertical: pad }}
                onScroll={onScroll}
                scrollEventThrottle={16}
                onScrollBeginDrag={onBegin}
                onMomentumScrollBegin={onBegin}
                onScrollEndDrag={onEnd}
                onMomentumScrollEnd={onEnd}
                nestedScrollEnabled
                keyboardDismissMode="on-drag"
            >
                {options.map((option, position) => (
                    <Row
                        key={String(option.id)}
                        label={option.label}
                        position={position}
                        offset={offset}
                        chosen={position === index}
                        visible={visible}
                        rowHeight={rowHeight}
                        style={style}
                        color={colors.textPrimary}
                        onPress={() => choose(position)}
                    />
                ))}
            </Animated.ScrollView>
        </View>
    );
}

/**
 * The band the chosen row sits in: the matte surface, no outline. Behind one
 * wheel, or stretched behind a row of them (pass `style` to set its sides).
 */
export function WheelBand({ rowHeight = WHEEL_ROW, visible = 3, style }: { rowHeight?: number; visible?: 3 | 5; style?: ViewStyle }) {
    return (
        <MatteSurface pointerEvents="none" radius={Radius.small} level="control" elevation="none"
            style={[styles.window, { top: (rowHeight * visible - rowHeight) / 2, height: rowHeight }, style]} />
    );
}

/** One row, shaped every frame by how far it is from the middle. */
function Row({ label, position, offset, chosen, visible, style, color, onPress, rowHeight }: {
    label: string; position: number; offset: SharedValue<number>; chosen: boolean; visible: number; rowHeight: number;
    style?: TextStyle; color: string; onPress: () => void;
}) {
    const reach = (visible - 1) / 2 + 0.5;
    const shape = useAnimatedStyle(() => {
        const distance = (position * rowHeight - offset.value) / rowHeight;
        const away = Math.abs(distance);
        return {
            opacity: interpolate(away, [0, 1, reach], [1, 0.42, 0.12], Extrapolation.CLAMP),
            transform: [
                { perspective: 400 },
                { rotateX: `${interpolate(distance, [-reach, 0, reach], [55, 0, -55], Extrapolation.CLAMP)}deg` },
                { scale: interpolate(away, [0, 1, reach], [1, 0.88, 0.8], Extrapolation.CLAMP) },
            ],
        };
    });
    return (
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: chosen }} accessibilityLabel={label}
            onPress={onPress} style={[styles.row, { height: rowHeight }]}>
            <Animated.Text numberOfLines={1} style={[styles.label, style, { color }, shape]}>{label}</Animated.Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    frame: { flex: 1, overflow: 'hidden' },
    window: { position: 'absolute', left: 0, right: 0 },
    row: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    label: { fontSize: 16, fontFamily: FontFamily.semibold },
});
