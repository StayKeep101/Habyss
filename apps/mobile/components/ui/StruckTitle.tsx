import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';
import { MOTION } from '@/components/ui/Motion';
import { s } from '@/theme/scale';

const GLIDE = { duration: MOTION.duration, easing: MOTION.easing, reduceMotion: ReduceMotion.System };

/**
 * A name that is struck through when it is done: the line draws across it
 * from the left as the name dims, and lifts away the same way when undone.
 * `struck` defaults to `done`; pass false to dim without the line.
 */
export function StruckTitle({ title, done, struck = done, style }: { title: string; done: boolean; struck?: boolean; style: StyleProp<TextStyle> }) {
    const t = useTokens();
    const tone = useAnimatedStyle(() => ({ color: withTiming(done ? t.color.textSubtle : t.color.textPrimary, GLIDE) }));
    const line = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(struck ? 1 : 0, GLIDE) }] }));
    return (
        <View style={styles.wrap}>
            <Animated.Text numberOfLines={1} style={[style, tone]}>{title}</Animated.Text>
            <Animated.View pointerEvents="none" style={[styles.strike, { backgroundColor: t.color.textSubtle }, line]} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flexShrink: 1 },
    strike: { position: 'absolute', left: 0, right: 0, top: '50%', height: s(1.5), transformOrigin: 'left' },
});
