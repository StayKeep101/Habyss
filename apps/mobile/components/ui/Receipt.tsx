import React, { useEffect } from 'react';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { Control, Spacing } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';
import { AnimatedCircle, CountUp, useProgress } from './Motion';
import { AppIcon } from './AppIcon';
import { Text } from './Text';

const SIZE = Control.height + Spacing.xxl;
const STROKE = Spacing.xs;
const RADIUS = (SIZE - STROKE) / 2;
const ROUND = 2 * Math.PI * RADIUS;

/**
 * The moment something is paid for, the way paying with a phone feels: a
 * cobalt ring closes, the tick lands with a medium tap then a success buzz and
 * the "complete" sound, and the amount counts in under it ("−25 ◆"). Then a
 * short line for what it bought. Motion tier 2 (docs/motion-system.md): 700
 * ms, one staged reveal, no bounce. Reduce Motion shows it finished, with the
 * same haptics. Tap to skip; it calls `onDone` after a beat either way.
 */
export function Receipt({ title, amount, unit = 'Shards', line, onDone }: {
    title: string;
    /** Signed: −25 spent, +50 won. Leave out for a moment with no Shards. */
    amount?: number;
    unit?: string;
    line?: string;
    onDone: () => void;
}) {
    const t = useTokens();
    const { mediumFeedback, successFeedback } = useHaptics();
    const { playComplete } = useSoundEffects();
    const ring = useProgress(1, 0, undefined, DURATION.reward);
    const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ROUND * (1 - ring.get()) }));

    useEffect(() => {
        mediumFeedback();
        // The tick lands as the ring closes.
        const land = setTimeout(() => { successFeedback(); playComplete(); }, DURATION.emphasis);
        const done = setTimeout(onDone, DURATION.reward + DURATION.reward);
        return () => { clearTimeout(land); clearTimeout(done); };
        // Plays once, when it appears.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const said = amount === undefined ? '' : `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${Math.abs(amount)}`;
    return (
        <Pressable onPress={onDone} style={styles.wrap} accessibilityRole="button" accessibilityLiveRegion="polite"
            accessibilityLabel={`${title}${said ? `, ${said} ${unit}` : ''}${line ? `. ${line}` : ''}`}>
            <View style={styles.badge}>
                <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                    <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={t.color.cobalt} strokeWidth={STROKE} fill="none"
                        strokeLinecap="round" strokeDasharray={`${ROUND} ${ROUND}`} animatedProps={ringProps}
                        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
                </Svg>
                <Animated.View entering={FadeIn.delay(DURATION.emphasis).duration(DURATION.quick).reduceMotion(ReduceMotion.System)}>
                    <AppIcon name="checkmark" size={Control.hitTarget - Spacing.md} color={t.color.cobalt} />
                </Animated.View>
            </View>
            <Text variant="title" align="center">{title}</Text>
            {said ? (
                <View style={styles.amount}>
                    <CountUp value={said} style={[t.type.display, { color: amount! < 0 ? t.color.textPrimary : t.color.cobalt }]} />
                    <ShardIcon size={Control.icon} />
                </View>
            ) : null}
            {line ? <Text variant="bodySmall" tone="muted" align="center">{line}</Text> : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
    badge: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
    amount: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
