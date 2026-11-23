import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon, MatteSurface, Text } from '@/components/ui';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { useTokens } from '@/hooks/useTokens';
import type { Challenge } from '@/lib/challenges';
import { DURATION } from '@/theme/motion';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useLevelColor } from './ChallengeParts';

// A heartbeat: two quick beats, then a rest (a long stretch of DURATION.reward).
const BEAT = { duration: DURATION.quick, easing: Easing.out(Easing.quad) };

/** The challenge's icon, beating like a heart (still with Reduce Motion). */
export function Heartbeat({ icon, color, size }: { icon: string; color: string; size: number }) {
    const reduced = useReducedMotion();
    const scale = useSharedValue(1);
    useEffect(() => {
        if (reduced) return;
        scale.set(withRepeat(withSequence(
            withTiming(1.14, BEAT), withTiming(1, BEAT), withTiming(1.1, BEAT), withTiming(1, { duration: DURATION.reward * 1.6 }),
        ), -1));
    }, [reduced, scale]);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
    return <Animated.View style={style}><AppIcon name={icon as never} filled size={size} color={color} /></Animated.View>;
}

/**
 * A challenge, as a card you want to tap: its colour glowing from the corner
 * (red for hard), its length in huge figures, its name and what it asks, and
 * the stakes: how many rules a day, that one miss ends it, the Shards. One
 * you or a friend wrote says who. `big`: the featured one, taller.
 */
export function ChallengeCard({ challenge, onPress, big = false, by }: { challenge: Challenge; onPress: () => void; big?: boolean; by?: string }) {
    const t = useTokens();
    const color = useLevelColor()[challenge.difficulty];
    const rules = challenge.items.length;
    // Its length in huge figures: twice the display size when featured.
    const figure = Math.round((t.type.display.fontSize ?? 44) * (big ? 2 : 1.3));
    return (
        <Pressable onPress={onPress} accessibilityRole="button"
            accessibilityLabel={`${challenge.title}. ${challenge.days} days, ${rules} ${rules === 1 ? 'rule' : 'rules'} a day${challenge.reward ? `, ${challenge.reward} Shards` : ''}. ${challenge.summary}`}>
            <MatteSurface radius={Radius.card} elevation="floating" style={[styles.card, big && styles.big]}>
                <LinearGradient pointerEvents="none" colors={[t.tint('soft', color), 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                <View style={styles.top}>
                    <Heartbeat icon={challenge.icon} color={color} size={big ? Spacing.section + Spacing.sm : Spacing.xxl + Spacing.xs} />
                    {challenge.reward ? (
                        <View style={[styles.reward, { backgroundColor: t.tint('subtle', t.color.cobalt) }]}>
                            <ShardIcon size={Spacing.lg} />
                            <Text variant="caption" numeric>{challenge.reward.toLocaleString()}</Text>
                        </View>
                    ) : by ? <Text variant="caption" tone="muted">{by}</Text> : null}
                </View>
                {/* Its length, the first thing you see. */}
                <View style={styles.days}>
                    <RNText style={[styles.daysFigure, { color: t.color.textPrimary, fontSize: figure, lineHeight: figure * 1.05 }]}>{challenge.days}</RNText>
                    <Text variant="heading" tone="muted">days</Text>
                </View>
                <Text variant="title" numberOfLines={1}>{challenge.title}</Text>
                <Text variant="bodySmall" tone="muted" numberOfLines={big ? 3 : 2}>{challenge.summary}</Text>
                <View style={styles.chips}>
                    <Chip icon="list" label={`${rules} ${rules === 1 ? 'rule' : 'rules'} a day`} />
                    <Chip icon="skull" label="Miss once, it’s over" color={t.color.danger} />
                </View>
            </MatteSurface>
        </Pressable>
    );
}

function Chip({ icon, label, color }: { icon: string; label: string; color?: string }) {
    const t = useTokens();
    return (
        <View style={[styles.chip, { backgroundColor: t.color.surfaceRaised }]}>
            <AppIcon name={icon as never} filled size={Spacing.md + 2} color={color ?? t.color.textMuted} />
            <Text variant="caption" tone={color ? 'danger' : 'muted'}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.lg, gap: Spacing.sm, overflow: 'hidden' },
    big: { paddingVertical: Spacing.xl },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    reward: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs / 2, borderRadius: Radius.pill },
    days: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    daysFigure: { fontFamily: FontFamily.bold, letterSpacing: -2, fontVariant: ['tabular-nums'], paddingRight: Spacing.xs },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
    chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
});
