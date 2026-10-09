import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';

const SLIDE = { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * A segmented control, the way iOS draws one: a track, and a thumb that slides
 * to what you chose. Every option is visible and one tap away, which is what a
 * wheel was hiding — you had to turn it to find out what else there was.
 */
export function Segmented<T extends string | number>({ options, value, onChange, accessibilityLabel }: {
    options: { id: T; label: string }[];
    value: T;
    onChange: (id: T) => void;
    accessibilityLabel?: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const light = theme === 'light';
    const { selectionFeedback } = useHaptics();
    const [width, setWidth] = useState(0);
    const index = Math.max(0, options.findIndex(option => option.id === value));
    const segment = width ? (width - 4) / options.length : 0;
    const x = useSharedValue(0);
    useEffect(() => { x.set(width ? withTiming(index * segment, SLIDE) : 0); }, [index, segment, width, x]);
    const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

    return (
        <View
            accessibilityRole="radiogroup"
            accessibilityLabel={accessibilityLabel}
            onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
            style={[styles.track, { backgroundColor: light ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.08)' }]}
        >
            {width ? (
                <Animated.View style={[styles.thumb, thumb, {
                    width: segment,
                    backgroundColor: light ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
                }]} />
            ) : null}
            {options.map(option => {
                const on = option.id === value;
                return (
                    <Pressable
                        key={String(option.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={option.label}
                        onPress={() => { if (!on) { selectionFeedback(); onChange(option.id); } }}
                        style={styles.segment}
                    >
                        <Text numberOfLines={1} style={[styles.label, {
                            color: on ? colors.textPrimary : colors.textSecondary,
                            fontFamily: on ? FontFamily.semibold : FontFamily.medium,
                        }]}>{option.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    track: { flexDirection: 'row', borderRadius: 11, padding: 2, minHeight: 36 },
    thumb: {
        position: 'absolute', top: 2, bottom: 2, left: 2, borderRadius: 9,
        shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    },
    segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 2 },
    label: { fontSize: 13 },
});
