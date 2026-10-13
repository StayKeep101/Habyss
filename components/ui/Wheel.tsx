import React, { useCallback, useEffect, useRef } from 'react';
import {
    NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle,
} from 'react-native';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

export const WHEEL_ROW = 40;

export interface WheelOption<T> {
    id: T;
    label: string;
}

/**
 * One choice at a time, turned rather than tapped.
 *
 * A row of chips shows every answer at once, which is the right shape for three
 * of them and the wrong shape for seven: the eye has to read all seven to pick
 * one, and the row wraps onto two lines and stops looking like a control. A
 * wheel shows the answer and hides the rest, which is what iOS uses everywhere
 * the question has more than a handful of answers.
 *
 * Built out of a ScrollView rather than a native picker because there is no
 * wheel in this project's dependencies and adding one would mean a native
 * rebuild for a component that is forty lines of snapping. It also means two
 * can sit side by side and agree about their height, which a `UIPickerView`
 * makes surprisingly hard.
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
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const ref = useRef<ScrollView>(null);
    const index = Math.max(0, options.findIndex(option => option.id === value));
    const height = WHEEL_ROW * visible;
    const pad = (height - WHEEL_ROW) / 2;
    /** What the wheel is showing, so a scroll it caused is not reported back. */
    const settled = useRef(index);

    useEffect(() => {
        if (settled.current === index) return;
        settled.current = index;
        ref.current?.scrollTo({ y: index * WHEEL_ROW, animated: true });
    }, [index]);

    const onSettle = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const landed = Math.round(event.nativeEvent.contentOffset.y / WHEEL_ROW);
        const clamped = Math.min(options.length - 1, Math.max(0, landed));
        if (clamped === settled.current) return;
        settled.current = clamped;
        selectionFeedback();
        onChange(options[clamped].id);
    }, [options, onChange, selectionFeedback]);

    return (
        <View style={[styles.frame, { height }]} testID={testID}>
            {/* The window. Behind the rows so the chosen one is not tinted by it. */}
            <View
                pointerEvents="none"
                style={[styles.window, {
                    top: pad, height: WHEEL_ROW,
                    backgroundColor: theme === 'light' ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                }]}
            />

            <ScrollView
                ref={ref}
                showsVerticalScrollIndicator={false}
                snapToInterval={WHEEL_ROW}
                decelerationRate="fast"
                contentOffset={{ x: 0, y: index * WHEEL_ROW }}
                contentContainerStyle={{ paddingVertical: pad }}
                onMomentumScrollEnd={onSettle}
                // A slow drag that stops without momentum never fires the one
                // above, and a wheel that quietly keeps the old answer is worse
                // than one that is a frame late.
                onScrollEndDrag={onSettle}
                nestedScrollEnabled
            >
                {options.map((option, position) => {
                    const chosen = position === index;
                    return (
                        // Tappable as well as turnable, which is what a
                        // UIPickerView does — and the only way somebody using a
                        // screen reader can reach a row at all.
                        <Pressable
                            key={String(option.id)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: chosen }}
                            accessibilityLabel={option.label}
                            onPress={() => {
                                if (chosen) return;
                                settled.current = position;
                                ref.current?.scrollTo({ y: position * WHEEL_ROW, animated: true });
                                selectionFeedback();
                                onChange(option.id);
                            }}
                            style={[styles.row, { height: WHEEL_ROW }]}
                        >
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.label,
                                    style,
                                    {
                                        color: chosen ? colors.textPrimary : colors.textTertiary,
                                        fontFamily: chosen ? FontFamily.semibold : FontFamily.regular,
                                        opacity: chosen ? 1 : 0.55,
                                    },
                                ]}
                            >
                                {option.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    frame: { flex: 1, overflow: 'hidden' },
    window: { position: 'absolute', left: 0, right: 0, borderRadius: 10 },
    row: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    label: { fontSize: 15 },
});
