import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type TextStyle } from 'react-native';
import Animated, {
    Extrapolation, interpolate, runOnJS, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle,
    useSharedValue, type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { MatteSurface } from './MatteSurface';

export const WHEEL_ROW = 40;

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
 * way a screen reader can reach a row.
 */
export function Wheel<T extends string | number>({ options, value, onChange, visible = 3, style, testID }: {
    options: WheelOption<T>[];
    value: T;
    onChange: (id: T) => void;
    /** How many rows are on screen. Odd, so one is in the middle. */
    visible?: 3 | 5;
    style?: TextStyle;
    testID?: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme] ?? Colors.abyss;
    const { selectionFeedback } = useHaptics();
    const ref = useAnimatedRef<Animated.ScrollView>();
    const index = Math.max(0, options.findIndex(option => option.id === value));
    const height = WHEEL_ROW * visible;
    const pad = (height - WHEEL_ROW) / 2;

    const offset = useSharedValue(index * WHEEL_ROW);
    const centred = useSharedValue(index);
    /** The row the wheel is resting on, so a scroll it caused is not reported back. */
    const settled = useRef(index);
    const touching = useRef(false);

    // The value changed from outside (another control, a reset): turn to it,
    // unless the finger is on the wheel — then the finger wins.
    useEffect(() => {
        if (touching.current || settled.current === index) return;
        settled.current = index;
        ref.current?.scrollTo({ y: index * WHEEL_ROW, animated: true });
    }, [index, ref]);

    const tick = useCallback(() => selectionFeedback(), [selectionFeedback]);

    const onScroll = useAnimatedScrollHandler({
        onScroll: event => {
            offset.value = event.contentOffset.y;
            const row = Math.min(options.length - 1, Math.max(0, Math.round(event.contentOffset.y / WHEEL_ROW)));
            if (row !== centred.value) {
                centred.value = row;
                runOnJS(tick)();
            }
        },
    });

    const commit = useCallback((y: number) => {
        const row = Math.min(options.length - 1, Math.max(0, Math.round(y / WHEEL_ROW)));
        if (row === settled.current) return;
        settled.current = row;
        onChange(options[row].id);
    }, [options, onChange]);

    const onMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        touching.current = false;
        commit(event.nativeEvent.contentOffset.y);
    }, [commit]);

    // Let go without a flick: nothing more is coming, so snap to the nearest
    // row and report it. Let go with one: wait for the momentum to finish.
    const onDragEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (Math.abs(event.nativeEvent.velocity?.y ?? 0) > 0.05) return;
        touching.current = false;
        const y = event.nativeEvent.contentOffset.y;
        ref.current?.scrollTo({ y: Math.round(y / WHEEL_ROW) * WHEEL_ROW, animated: true });
        commit(y);
    }, [commit, ref]);

    return (
        <View style={[styles.frame, { height }]} testID={testID}>
            {/* The window, behind the rows: the matte surface, no outline. */}
            <MatteSurface pointerEvents="none" radius={Radius.small} level="control" elevation="none"
                style={[styles.window, { top: pad, height: WHEEL_ROW }]} />

            <Animated.ScrollView
                ref={ref}
                showsVerticalScrollIndicator={false}
                snapToInterval={WHEEL_ROW}
                decelerationRate="fast"
                contentOffset={{ x: 0, y: index * WHEEL_ROW }}
                contentContainerStyle={{ paddingVertical: pad }}
                onScroll={onScroll}
                scrollEventThrottle={16}
                onScrollBeginDrag={() => { touching.current = true; }}
                onScrollEndDrag={onDragEnd}
                onMomentumScrollEnd={onMomentumEnd}
                nestedScrollEnabled
            >
                {options.map((option, position) => (
                    <Row
                        key={String(option.id)}
                        label={option.label}
                        position={position}
                        offset={offset}
                        chosen={position === index}
                        visible={visible}
                        style={style}
                        color={colors.textPrimary}
                        onPress={() => {
                            if (position === settled.current) return;
                            settled.current = position;
                            ref.current?.scrollTo({ y: position * WHEEL_ROW, animated: true });
                            selectionFeedback();
                            onChange(option.id);
                        }}
                    />
                ))}
            </Animated.ScrollView>
        </View>
    );
}

/** One row, shaped every frame by how far it is from the middle. */
function Row({ label, position, offset, chosen, visible, style, color, onPress }: {
    label: string; position: number; offset: SharedValue<number>; chosen: boolean; visible: number;
    style?: TextStyle; color: string; onPress: () => void;
}) {
    const reach = (visible - 1) / 2 + 0.5;
    const shape = useAnimatedStyle(() => {
        const distance = (position * WHEEL_ROW - offset.value) / WHEEL_ROW;
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
            onPress={onPress} style={[styles.row, { height: WHEEL_ROW }]}>
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
