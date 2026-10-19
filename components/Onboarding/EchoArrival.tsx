import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, ReduceMotion, SlideInUp } from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';
import { ECHO_NAME } from '@/lib/echo';
import { EchoOrb } from './EchoOrb';

/**
 * Meeting Echo, shown rather than explained. Echo's light comes down out of
 * the dark to meet yours, its rings start going out, and then only a few words.
 */
export function EchoArrival({ name, children }: { name?: string; children?: React.ReactNode }) {
    const t = useTokens();
    return (
        <View style={[styles.wrap, { gap: t.space.lg, paddingHorizontal: t.space.xl }]}>
            <Animated.View entering={SlideInUp.duration(1100).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)}>
                <EchoOrb />
            </Animated.View>
            <Animated.Text entering={FadeInUp.delay(1100).duration(600)} style={[t.type.screenTitle, styles.center, { color: t.color.textPrimary }]}>
                This is {ECHO_NAME}.
            </Animated.Text>
            <Animated.View entering={FadeIn.delay(1700).duration(600)}>
                <Text style={[t.type.body, styles.center, { color: t.color.textMuted }]}>
                    The voice that comes back when the climb goes quiet{name ? `, ${name}` : ''}.
                </Text>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(2300).duration(500)} style={styles.action}>
                {children}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    center: { textAlign: 'center' },
    action: { alignSelf: 'stretch' },
});
