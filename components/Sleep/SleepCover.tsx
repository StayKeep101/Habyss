import React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { AppIcon, Overlay, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useAsleep } from '@/lib/bedtimeLock';
import { DURATION } from '@/theme/motion';

/**
 * Habyss asleep (lib/bedtimeLock.ts): when the day is done, one quiet screen
 * over the whole app, sheets and Focus included, until wake. Nothing to tap.
 */
export function SleepCover() {
    const t = useTokens();
    const { asleep, wake } = useAsleep();
    if (!asleep) return null;
    const [hour, minute] = wake.split(':').map(Number);
    const wakeText = new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return (
        <Overlay>
            <Animated.View
                entering={FadeIn.duration(DURATION.emphasis).reduceMotion(ReduceMotion.System)}
                exiting={FadeOut.duration(DURATION.base).reduceMotion(ReduceMotion.System)}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: t.color.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.space.xl }}
                accessibilityViewIsModal
                accessible
                accessibilityLabel={`The day is done. Habyss wakes at ${wakeText}.`}
            >
                <View style={{ alignItems: 'center', gap: t.space.sm }}>
                    <AppIcon name="moon" size={t.space['3xl']} color={t.color.textMuted} />
                    <Text variant="heading" align="center">The day is done</Text>
                    <Text variant="caption" tone="muted" align="center">{`Habyss wakes at ${wakeText}.`}</Text>
                </View>
            </Animated.View>
        </Overlay>
    );
}
