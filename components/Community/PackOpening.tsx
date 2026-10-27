import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing, ReduceMotion, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { AppButton } from '@/components/ui/AppButton';
import { Avatar } from '@/components/ui/Avatar';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/context/AccentContext';
import { FontFamily } from '@/theme/designSystem';
import { isPerfect, markOpened } from '@/lib/dailyPack';
import type { FeedPost } from '@/lib/feedService';
import { PackBack, PackCard } from './PackCard';

const CALM = { reduceMotion: ReduceMotion.System };
const FLIP_MS = 520;

/**
 * Opening today's pack, the way a pack of trading cards is opened: the
 * sealed pack, tapped or swiped across, tears open and the first card rises
 * out face down, then turns over with a sweep of light. Swipe a card away
 * (or tap it) for the next. The best day comes last, and a perfect day is the
 * rare card, with its foil edge. A cheer is one tap under each card.
 */
export function PackOpening({ visible, posts, startAt = 0, onClose, onCheer }: {
    visible: boolean;
    posts: FeedPost[];
    /** Cards already turned over today: reopening goes on from there. */
    startAt?: number;
    onClose: () => void;
    onCheer: (post: FeedPost) => void;
}) {
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const { colors: accent } = useAccentGradient();
    const { mediumFeedback, lightFeedback, successFeedback, selectionFeedback } = useHaptics();
    const cardWidth = Math.min(width - 64, 340);
    const cardHeight = Math.min(cardWidth * 1.42, height - insets.top - insets.bottom - 220);

    const [phase, setPhase] = useState<'sealed' | 'cards' | 'done'>('sealed');
    const [index, setIndex] = useState(0);
    const [cheered, setCheered] = useState<Set<string>>(new Set());
    useEffect(() => {
        if (!visible) return;
        const resume = Math.min(startAt, posts.length);
        setIndex(resume);
        setPhase(resume >= posts.length && posts.length ? 'done' : resume > 0 ? 'cards' : 'sealed');
        setCheered(new Set(posts.filter(post => post.ackedByMe).map(post => post.userId)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);
    const today = posts[0]?.day;
    useEffect(() => { if (visible && today && phase !== 'sealed') void markOpened(today, index + (phase === 'done' ? 0 : 1)); }, [visible, today, index, phase]);

    // ------------------------------------------------------------ the pack
    const float = useSharedValue(0);
    const tear = useSharedValue(0);
    useEffect(() => {
        if (!visible || phase !== 'sealed') return;
        tear.value = 0;
        float.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin), ...CALM }), -1, true);
    }, [visible, phase, float, tear]);
    const packStyle = useAnimatedStyle(() => ({
        opacity: interpolate(tear.value, [0.4, 1], [1, 0]),
        transform: [
            { translateY: interpolate(float.value, [0, 1], [0, -8]) + interpolate(tear.value, [0.3, 1], [0, height * 0.6]) },
            { rotate: `${interpolate(float.value, [0, 1], [-1.2, 1.2])}deg` },
        ],
    }));
    const stripStyle = useAnimatedStyle(() => ({
        opacity: interpolate(tear.value, [0, 0.6], [1, 0]),
        transform: [{ translateY: interpolate(tear.value, [0, 1], [0, -height * 0.4]) }, { translateX: interpolate(tear.value, [0, 1], [0, width * 0.4]) }, { rotate: `${interpolate(tear.value, [0, 1], [0, 28])}deg` }],
    }));
    const open = () => {
        if (phase !== 'sealed') return;
        mediumFeedback();
        tear.value = withTiming(1, { duration: 650, easing: Easing.in(Easing.cubic), ...CALM }, done => { if (done) runOnJS(setPhase)('cards'); });
    };
    const swipeOpen = Gesture.Pan().runOnJS(true).onEnd(event => { if (Math.abs(event.translationX) > 60 || event.translationY < -60) open(); });
    const tapOpen = Gesture.Tap().runOnJS(true).onEnd(open);

    // ----------------------------------------------------------- the cards
    const x = useSharedValue(0);
    const y = useSharedValue(0);
    const flip = useSharedValue(1);
    const rise = useSharedValue(0);
    const shine = useSharedValue(0);
    const current = posts[index];
    useEffect(() => {
        if (!visible || phase !== 'cards' || !current) return;
        x.value = 0; y.value = 0; flip.value = 1; shine.value = 0;
        rise.value = 0;
        rise.value = withSpring(1, { damping: 16, stiffness: 140, ...CALM });
        flip.value = withDelay(260, withTiming(0, { duration: FLIP_MS, easing: Easing.out(Easing.cubic), ...CALM }));
        shine.value = withDelay(260 + FLIP_MS - 120, withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad), ...CALM }));
        const turned = setTimeout(() => { if (isPerfect(current)) successFeedback(); else lightFeedback(); }, 260 + FLIP_MS / 2);
        return () => clearTimeout(turned);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, phase, index]);
    const next = () => {
        if (index + 1 >= posts.length) { setPhase('done'); return; }
        setIndex(value => value + 1);
    };
    const throwAway = (direction: number) => {
        selectionFeedback();
        x.value = withTiming(direction * width * 1.3, { duration: 260, easing: Easing.in(Easing.quad), ...CALM }, done => { if (done) runOnJS(next)(); });
    };
    const drag = Gesture.Pan()
        .onUpdate(event => { x.value = event.translationX; y.value = event.translationY * 0.35; })
        .onEnd(event => {
            if (Math.abs(event.translationX) > 110 || Math.abs(event.velocityX) > 800) runOnJS(throwAway)(Math.sign(event.translationX || event.velocityX) || 1);
            else { x.value = withSpring(0, CALM); y.value = withSpring(0, CALM); }
        });
    const tapNext = Gesture.Tap().runOnJS(true).onEnd(() => throwAway(-1));
    const cardMove = useAnimatedStyle(() => ({
        transform: [
            { translateX: x.value }, { translateY: y.value + interpolate(rise.value, [0, 1], [height * 0.3, 0]) },
            { rotate: `${x.value / 18}deg` }, { scale: interpolate(rise.value, [0, 1], [0.7, 1]) },
        ],
    }));
    const front = useAnimatedStyle(() => ({ opacity: flip.value < 0.5 ? 1 : 0, transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }] }));
    const back = useAnimatedStyle(() => ({ opacity: flip.value >= 0.5 ? 1 : 0, transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180 - 180}deg` }] }));
    const shineStyle = useAnimatedStyle(() => ({ opacity: interpolate(shine.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]), transform: [{ translateX: interpolate(shine.value, [0, 1], [-cardWidth * 1.2, cardWidth * 1.2]) }, { rotate: '20deg' }] }));

    const cheer = (post: FeedPost) => {
        if (cheered.has(post.userId)) return;
        successFeedback();
        setCheered(set => new Set(set).add(post.userId));
        onCheer(post);
    };

    return (
        <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
            <GestureHandlerRootView style={styles.fill}>
                <View style={[styles.fill, { backgroundColor: t.color.background }]}>
                    <LinearGradient pointerEvents="none" colors={[`${accent[0]}33`, `${accent[1]}10`, 'transparent']} locations={[0, 0.4, 0.8]} style={StyleSheet.absoluteFill} />
                    <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
                        <IconButton icon="close" label="Close the pack" onPress={onClose} diameter={40} size={20} />
                        <Text style={[styles.count, { color: t.color.textMuted }]} accessibilityLiveRegion="polite">
                            {phase === 'cards' && posts.length ? `${index + 1} of ${posts.length}` : ''}
                        </Text>
                        <View style={styles.side} />
                    </View>

                    <View style={styles.stage}>
                        {phase === 'sealed' ? (
                            <GestureDetector gesture={Gesture.Exclusive(swipeOpen, tapOpen)}>
                                <View style={styles.center} accessible accessibilityRole="button" accessibilityLabel={`Today's pack, ${posts.length} ${posts.length === 1 ? 'card' : 'cards'}. Open`}>
                                    <Animated.View style={packStyle}>
                                        <Pack width={cardWidth * 0.82} height={cardHeight * 0.95} colors={accent} faces={posts.slice(0, 3)} count={posts.length} />
                                    </Animated.View>
                                    <Animated.View pointerEvents="none" style={[styles.strip, { width: cardWidth * 0.82, top: undefined }, stripStyle]}>
                                        <LinearGradient colors={[accent[0], accent[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stripFill} />
                                    </Animated.View>
                                    <Text style={[styles.hint, { color: t.color.textMuted }]}>Tap or swipe to open</Text>
                                </View>
                            </GestureDetector>
                        ) : phase === 'cards' && current ? (
                            <View style={styles.center}>
                                {/* The next card waits face down behind. */}
                                {posts[index + 1] ? (
                                    <View style={[styles.behind, { width: cardWidth, height: cardHeight }]} pointerEvents="none">
                                        <PackBack width={cardWidth} height={cardHeight} colors={accent} />
                                    </View>
                                ) : null}
                                <GestureDetector gesture={Gesture.Exclusive(drag, tapNext)}>
                                    <Animated.View key={current.userId} style={[{ width: cardWidth, height: cardHeight }, cardMove]}>
                                        <Animated.View style={[StyleSheet.absoluteFill, back]}>
                                            <PackBack width={cardWidth} height={cardHeight} colors={accent} />
                                        </Animated.View>
                                        <Animated.View style={[StyleSheet.absoluteFill, front]}>
                                            <PackCard post={current} width={cardWidth} height={cardHeight} />
                                            <View pointerEvents="none" style={styles.shineClip}>
                                                <Animated.View style={[styles.shine, { height: cardHeight * 1.6 }, shineStyle]}>
                                                    <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                                                </Animated.View>
                                            </View>
                                        </Animated.View>
                                    </Animated.View>
                                </GestureDetector>
                                <View style={styles.actions}>
                                    <AppButton label={cheered.has(current.userId) ? 'Cheered' : `Cheer ${current.name.split(' ')[0]}`} icon={cheered.has(current.userId) ? 'heart' : 'heart-outline'}
                                        variant={cheered.has(current.userId) ? 'ghost' : 'default'} fullWidth={false} onPress={() => cheer(current)} />
                                    <Text style={[styles.hint, { color: t.color.textMuted }]}>Swipe for the next card</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={[styles.center, styles.doneWrap]}>
                                <Text style={[styles.doneTitle, { color: t.color.textPrimary }]}>{posts.length ? "That's everyone today" : 'No cards yet today'}</Text>
                                <Text style={[styles.doneBody, { color: t.color.textMuted }]}>
                                    {posts.length ? 'A new pack comes tomorrow, with how their next day went.' : "Your friends' cards arrive at the times they choose."}
                                </Text>
                                <AppButton label="Done" fullWidth={false} onPress={onClose} />
                            </View>
                        )}
                    </View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

/** The sealed pack: foil in the accent, a tear line near the top, the faces inside. */
export function Pack({ width, height, colors, faces, count }: { width: number; height: number; colors: readonly [string, string]; faces: FeedPost[]; count: number }) {
    return (
        <View style={[styles.pack, { width, height }]}>
            <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.25)']} locations={[0, 0.35, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.tearLine} />
            <View style={styles.packBody}>
                <Text style={styles.packKicker}>Today's pack</Text>
                <View style={styles.packFaces}>
                    {faces.map((post, index) => (
                        <View key={post.userId} style={[styles.packFace, { marginLeft: index ? -12 : 0 }]}>
                            <Avatar name={post.name} uri={post.avatarUrl} size={40} />
                        </View>
                    ))}
                </View>
                <Text style={styles.packCount}>{count === 1 ? '1 card' : `${count} cards`}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
    side: { width: 40 },
    count: { fontSize: 15, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    center: { alignItems: 'center', justifyContent: 'center', gap: 22 },
    behind: { position: 'absolute', top: 6, transform: [{ scale: 0.94 }], opacity: 0.6 },
    shineClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, overflow: 'hidden' },
    shine: { position: 'absolute', top: '-30%', left: '25%', width: 90 },
    actions: { alignItems: 'center', gap: 10 },
    hint: { fontSize: 13, fontFamily: FontFamily.medium },
    doneWrap: { paddingHorizontal: 40 },
    doneTitle: { fontSize: 24, fontFamily: FontFamily.bold, textAlign: 'center' },
    doneBody: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.regular, textAlign: 'center' },
    pack: { borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    tearLine: { position: 'absolute', top: 44, left: 14, right: 14, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.5)' },
    packBody: { alignItems: 'center', gap: 14 },
    packKicker: { fontSize: 22, fontFamily: FontFamily.bold, color: '#FFFFFF' },
    packFaces: { flexDirection: 'row' },
    packFace: { borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
    packCount: { fontSize: 15, fontFamily: FontFamily.semibold, color: 'rgba(255,255,255,0.9)' },
    strip: { position: 'absolute', height: 44, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', opacity: 0 },
    stripFill: { flex: 1 },
});
