import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Animated, {
    Easing, FadeIn, FadeInDown, ReduceMotion, interpolate, runOnJS, useAnimatedStyle, useSharedValue,
    withDelay, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { rankTone, textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { RANKS } from '@/lib/marks';
import { RANK_ICONS, echoLineFor, type ClimbMoment } from '@/lib/climbMoments';
import { RankGem } from '@/components/ui/RankGem';

const RM = ReduceMotion.System;
const EMBLEM = 132;
const PARTICLES = 18;

/** Light rays behind the emblem: a ring of thin wedges. */
function Rays({ color }: { color: string }) {
    const size = 420, c = size / 2, count = 14;
    const wedges = Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2, w = Math.PI / count / 2.2;
        const p = (angle: number, r: number) => `${c + Math.cos(angle) * r} ${c + Math.sin(angle) * r}`;
        return `M ${c} ${c} L ${p(a - w, c)} L ${p(a + w, c)} Z`;
    });
    return (
        <Svg width={size} height={size}>
            {wedges.map((d, i) => <Path key={i} d={d} fill={color} opacity={0.16} />)}
        </Svg>
    );
}

/** One spark of the burst, flying out from the emblem and fading. */
function Particle({ index, burst, color }: { index: number; burst: SharedValue<number>; color: string }) {
    const angle = (index / PARTICLES) * Math.PI * 2 + (index % 3) * 0.2;
    const reach = 120 + (index % 4) * 28;
    const size = 5 + (index % 3) * 3;
    const style = useAnimatedStyle(() => ({
        opacity: interpolate(burst.value, [0, 0.15, 1], [0, 1, 0]),
        transform: [
            { translateX: Math.cos(angle) * reach * burst.value },
            { translateY: Math.sin(angle) * reach * burst.value },
            { scale: interpolate(burst.value, [0, 0.3, 1], [0.4, 1, 0.6]) },
        ],
    }));
    return <Animated.View pointerEvents="none" style={[styles.particle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/**
 * A beat of the climb, the way a game marks a level: the old rank, a flash,
 * the new emblem slamming in with rays turning behind it and sparks bursting
 * out, then the rank's name and Echo's line. Reaching a new rank opens its
 * league, so that is the second beat: the lock shakes and springs open. For
 * Beginner it is the big one, the first league ever unlocked. Your first
 * foothold gets the quieter version.
 */
export function ClimbMomentOverlay({ moment, onDone }: { moment: ClimbMoment | null; onDone: () => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary, colors: gradient } = useAccentGradient();
    const { successFeedback, mediumFeedback } = useHaptics();
    const [stage, setStage] = useState<'rank' | 'league'>('rank');
    const [lockOpen, setLockOpen] = useState(false);

    const intro = useSharedValue(0);   // the old rank, fading out
    const slam = useSharedValue(0);    // the new emblem arriving
    const flash = useSharedValue(0);
    const burst = useSharedValue(0);
    const spin = useSharedValue(0);
    const lock = useSharedValue(0);    // 0 closed → shaking → 1 open

    const isRank = moment?.kind === 'rankUp';
    const index = isRank ? moment.index : 0;
    const previous = isRank ? RANKS[Math.max(0, index - 1)].name : null;
    const unlocksFirstLeague = isRank && index === 1;

    useEffect(() => {
        if (!moment) return;
        setStage('rank');
        intro.value = 0; slam.value = 0; flash.value = 0; burst.value = 0; spin.value = 0; lock.value = 0;
        const land = () => { successFeedback(); };
        intro.value = withSequence(withTiming(1, { duration: 450, reduceMotion: RM }), withDelay(350, withTiming(2, { duration: 250, reduceMotion: RM })));
        slam.value = withDelay(1000, withSpring(1, { damping: 9, stiffness: 160, mass: 0.9, reduceMotion: RM }, done => { if (done) runOnJS(land)(); }));
        flash.value = withDelay(1000, withSequence(withTiming(1, { duration: 90, reduceMotion: RM }), withTiming(0, { duration: 600, reduceMotion: RM })));
        burst.value = withDelay(1050, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic), reduceMotion: RM }));
        // Turns slowly and stops: nothing runs forever.
        spin.value = withDelay(900, withTiming(1, { duration: 6000, easing: Easing.out(Easing.quad), reduceMotion: RM }));
    }, [moment, intro, slam, flash, burst, spin, lock, successFeedback]);

    const openLeague = () => {
        setStage('league');
        setLockOpen(false);
        // Closed while it rattles; open as it springs.
        setTimeout(() => setLockOpen(true), 470);
        lock.value = 0;
        // Rattles, then springs open.
        lock.value = withSequence(
            withTiming(0.12, { duration: 70 }), withTiming(-0.12, { duration: 70 }), withTiming(0.1, { duration: 70 }),
            withTiming(-0.1, { duration: 70 }), withTiming(0, { duration: 70 }),
            withDelay(120, withSpring(1, { damping: 10, stiffness: 180, reduceMotion: RM }, done => { if (done) runOnJS(successFeedback)(); })),
        );
        mediumFeedback();
    };

    const oldStyle = useAnimatedStyle(() => ({
        opacity: interpolate(intro.value, [0, 1, 2], [0, 1, 0]),
        transform: [{ scale: interpolate(intro.value, [0, 1, 2], [0.9, 1, 0.6]) }],
    }));
    const emblemStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, slam.value * 2),
        transform: [{ scale: interpolate(slam.value, [0, 1], [2.4, 1]) }],
    }));
    const raysStyle = useAnimatedStyle(() => ({
        opacity: interpolate(slam.value, [0, 1], [0, 1]),
        transform: [{ rotate: `${spin.value * 140}deg` }, { scale: interpolate(slam.value, [0, 1], [0.4, 1]) }],
    }));
    const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.85 }));
    const shackleStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${lock.value < 0.2 ? lock.value * 60 : 0}deg` },
            { translateY: interpolate(lock.value, [0.2, 1], [0, -10], 'clamp') },
        ],
    }));
    // A soft halo that brightens as it opens: never solid, so the lock reads over it.
    const glowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(lock.value, [0.2, 1], [0, 0.22], 'clamp'),
        transform: [{ scale: interpolate(lock.value, [0.2, 1], [0.6, 1.15], 'clamp') }],
    }));

    if (!moment) return null;
    const rankName = isRank ? moment.rank : 'Out of the dark';
    const icon = isRank ? RANK_ICONS[moment.rank] ?? 'star' : 'footsteps';
    // The light of the moment is the new rank's own colour.
    const shade = isRank ? rankTone(moment.rank).color : primary;

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <LinearGradient pointerEvents="none" colors={['transparent', `${gradient[0]}26`, `${gradient[1]}55`]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

                {stage === 'rank' ? (
                    <View style={styles.center}>
                        <View style={styles.stageBox}>
                            {/* The rank you are leaving, first. */}
                            {previous ? (
                                <Animated.View style={[styles.abs, oldStyle]}>
                                    <Text style={[styles.oldRank, { color: colors.textTertiary }]}>{previous}</Text>
                                </Animated.View>
                            ) : null}
                            <Animated.View pointerEvents="none" style={[styles.abs, raysStyle]}><Rays color={shade} /></Animated.View>
                            {Array.from({ length: PARTICLES }, (_, i) => <Particle key={i} index={i} burst={burst} color={i % 2 ? shade : gradient[1]} />)}
                            {/* A new rank lands as its gem, in its own colour; the first foothold keeps its emblem. */}
                            {isRank ? (
                                <Animated.View style={emblemStyle}>
                                    <RankGem rank={moment.rank} size={EMBLEM * 1.4} />
                                </Animated.View>
                            ) : (
                                <Animated.View style={[styles.emblem, { shadowColor: primary }, emblemStyle]}>
                                    <LinearGradient colors={[gradient[0], gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.emblemFill]} />
                                    <AppIcon name={icon as never} filled size={60} color={textOn(primary)} />
                                </Animated.View>
                            )}
                        </View>

                        <Animated.Text entering={FadeIn.delay(1300).duration(400)} style={[styles.kicker, { color: primary }]}>
                            {isRank ? 'Rank up' : 'Your first foothold'}
                        </Animated.Text>
                        <Animated.Text entering={FadeInDown.delay(1400).duration(450)} style={[styles.title, { color: colors.textPrimary }]}>{rankName}</Animated.Text>
                        <Animated.Text entering={FadeIn.delay(1900).duration(500)} style={[styles.echo, { color: colors.textSecondary }]}>“{echoLineFor(moment)}” — Echo</Animated.Text>
                    </View>
                ) : (
                    <View style={styles.center}>
                        {/* The league: a lock that rattles and springs open. */}
                        <View style={styles.lockBox}>
                            <Animated.View style={[styles.lockGlow, { backgroundColor: primary }, glowStyle]} />
                            <Animated.View style={shackleStyle}>
                                <AppIcon name={lockOpen ? 'lock-open' : 'lock-closed'} filled size={88} color={primary} />
                            </Animated.View>
                        </View>
                        <Animated.Text entering={FadeIn.delay(700).duration(400)} style={[styles.kicker, { color: primary }]}>
                            {unlocksFirstLeague ? 'Finally' : 'New league'}
                        </Animated.Text>
                        <Animated.Text entering={FadeInDown.delay(800).duration(450)} style={[styles.title, { color: colors.textPrimary }]}>
                            {unlocksFirstLeague ? 'League unlocked' : `${rankName} league`}
                        </Animated.Text>
                        <Animated.Text entering={FadeIn.delay(1100).duration(500)} style={[styles.echo, { color: colors.textSecondary }]}>
                            {unlocksFirstLeague
                                ? 'You’re out of Lost. Now you’re ranked against everyone at your height, worldwide. Climb past them.'
                                : `You’re now ranked with everyone in ${rankName}, worldwide.`}
                        </Animated.Text>
                    </View>
                )}

                <Animated.View entering={FadeIn.delay(stage === 'rank' ? 2200 : 1300).duration(400)} key={stage} style={styles.actions}>
                    {stage === 'rank' && isRank ? (
                        <AppButton label={unlocksFirstLeague ? 'Something unlocked…' : 'See your new league'} onPress={openLeague} />
                    ) : stage === 'league' ? (
                        <>
                            <AppButton label="Open my league" onPress={() => { onDone(); router.push({ pathname: '/(root)/leaderboard' as never, params: { scope: 'league' } }); }} />
                            <AppButton label="Keep climbing" variant="ghost" onPress={onDone} />
                        </>
                    ) : (
                        <AppButton label="Keep climbing" onPress={onDone} />
                    )}
                </Animated.View>

                {/* The flash as the emblem lands. */}
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: Spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    stageBox: { width: 300, height: 300, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    abs: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    oldRank: { fontFamily: FontFamily.bold, fontSize: 34, letterSpacing: -0.5 },
    emblem: { width: EMBLEM, height: EMBLEM, borderRadius: EMBLEM * 0.32, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.7, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
    emblemFill: { borderRadius: EMBLEM * 0.32 },
    particle: { position: 'absolute' },
    kicker: { fontFamily: FontFamily.bold, fontSize: 16 },
    title: { fontFamily: FontFamily.bold, fontSize: 42, lineHeight: 48, letterSpacing: -1, textAlign: 'center' },
    echo: { fontFamily: FontFamily.medium, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: Spacing.md, paddingHorizontal: Spacing.md },
    lockBox: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    lockGlow: { position: 'absolute', width: 170, height: 170, borderRadius: 85 },
    actions: { paddingBottom: Spacing.section + Spacing.lg, gap: Spacing.sm },
    flash: { backgroundColor: '#FFFFFF' },
});
