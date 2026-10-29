import React, { useCallback, useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { AppIcon, MatteSurface, Text } from '@/components/ui';
import { useCountUp } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { noteMarksTotal, onOrbLanded, registerMarksTarget } from '@/lib/marksOrbs';
import type { Marks } from '@/hooks/useMarks';
import { s } from '@/theme/scale';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE, timingFor } from '@/theme/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const FILL = timingFor(DURATION.reward, EASE.enter);
const SIZE = s(64);
const STROKE = s(4);

/**
 * You, with your Marks drawn around you: the ring fills toward the next rank,
 * like experience in a game, and your Marks sit in a small pill on its foot
 * (with the perfect-day multiplier beside them while it is running). Marks
 * are XP: they only go up, and how they are earned needs no page of its own.
 * The picture opens your profile. Marks orbs fly into the pill, and it gives
 * a little bump as each one lands.
 */
export const ProgressAvatar: React.FC<{ uri?: string | null; marks: Marks; onPress: () => void }> = ({ uri, marks, onPress }) => {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const radius = (SIZE - STROKE) / 2;
    const circumference = 2 * Math.PI * radius;

    // The ring: how far into this rank, toward the next.
    const filled = useSharedValue(0);
    useEffect(() => { filled.set(withTiming(Math.min(1, Math.max(0.02, marks.progress)), FILL)); }, [marks.progress, filled]);
    const ring = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - filled.get()) }));

    // Where the Marks orbs land while Home is in front, and the total the catch pill counts from elsewhere.
    const pillRef = useRef<View>(null);
    useFocusEffect(useCallback(() => registerMarksTarget('marks-ring', done => {
        const node = pillRef.current;
        if (!node) { done(null); return; }
        node.measureInWindow((x, y, width, height) => done(width ? { x: x + width / 2, y: y + height / 2 } : null));
    }), []));
    useEffect(() => { noteMarksTotal(marks.total); }, [marks.total]);
    const bump = useSharedValue(1);
    useEffect(() => onOrbLanded(() => {
        bump.set(withSequence(withTiming(1.1, { duration: DURATION.tap / 2 }), withTiming(1, { duration: DURATION.tap })));
    }), [bump]);
    const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));
    const total = useCountUp(marks.total.toLocaleString());

    const photo = SIZE - STROKE * 2 - s(4);
    return (
        <View style={styles.wrap}>
            <Pressable onPress={() => { lightFeedback(); onPress(); }} accessibilityRole="button" accessibilityLabel="Your profile" style={styles.avatar}>
                <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                    <Circle cx={SIZE / 2} cy={SIZE / 2} r={radius} stroke={t.color.surfaceRaised} strokeWidth={STROKE} fill="none" />
                    <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={radius} stroke={t.color.accent} strokeWidth={STROKE} strokeLinecap="round" fill="none"
                        strokeDasharray={`${circumference} ${circumference}`} animatedProps={ring} rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`} />
                </Svg>
                <View style={[styles.photo, { width: photo, height: photo, borderRadius: photo / 2, margin: STROKE + s(2), backgroundColor: t.color.surfaceRaised }]}>
                    {uri ? <Image source={{ uri }} style={styles.image} /> : <AppIcon name="person" size={Control.icon} color={t.color.textMuted} />}
                </View>
            </Pressable>

            {/* Your Marks on the ring's foot. */}
            <View accessible accessibilityLabel={`${marks.total} Marks, rank ${marks.rank.name}.${marks.next ? ` ${marks.toNext} to ${marks.next.name}.` : ''}${marks.multiplier > 1 ? ` Earning ×${marks.multiplier}.` : ''}`}
                style={styles.pillWrap}>
                <Animated.View ref={pillRef} collapsable={false} style={bumpStyle}>
                    <MatteSurface radius={Radius.pill} level="control" style={styles.pill}>
                        <Text variant="caption" numeric>{total}</Text>
                        {marks.multiplier > 1 ? <Text variant="caption" tone="accent" numeric>{`×${marks.multiplier}`}</Text> : null}
                    </MatteSurface>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { width: SIZE, alignItems: 'center' },
    avatar: { width: SIZE, height: SIZE },
    photo: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    image: { width: '100%', height: '100%' },
    // Over the ring's foot, so it reads as part of it.
    pillWrap: { marginTop: -Spacing.md },
    pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, minHeight: Spacing.xl },
});
