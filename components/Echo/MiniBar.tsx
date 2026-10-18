import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useProgress } from '@/components/ui/Motion';

/** A small bar that grows up to its value (0–5) when the page opens. */
export function MiniBar({ value, color, index }: { value: number | null; color: string; index: number }) {
    const grown = useProgress((value ?? 0) / 5, index * 40);
    const style = useAnimatedStyle(() => ({ height: 6 + grown.get() * 35 }));
    return <Animated.View style={[styles.bar, { backgroundColor: color, opacity: value ? 0.9 : 0.15 }, style]} />;
}

const styles = StyleSheet.create({ bar: { width: 8, borderRadius: 4 } });
