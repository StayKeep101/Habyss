import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text as RNText, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    FadeIn, FadeInDown, FadeOut, ReduceMotion, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { CARD_EMOJI, cardReactions, reactToCard, withMine, type CardReactions } from '@/lib/cardReactions';
import { Colors } from '@/theme/colors';
import { DURATION, EASE } from '@/theme/motion';
import { Radius, Spacing } from '@/theme/designSystem';
import type { PackPage } from './DayPack';

/** An emoji flying up from the bar when tapped, then gone. */
function Burst({ emoji, onDone }: { emoji: string; onDone: () => void }) {
    const rise = useSharedValue(0);
    useEffect(() => {
        rise.set(withTiming(1, { duration: DURATION.reward, easing: EASE.enter, reduceMotion: ReduceMotion.System }, done => { if (done) runOnJS(onDone)(); }));
    }, [rise, onDone]);
    const style = useAnimatedStyle(() => ({
        opacity: interpolate(rise.get(), [0, 0.2, 1], [0, 1, 0]),
        transform: [{ translateY: -Spacing.section * 4 * rise.get() }, { scale: 1 + rise.get() * 1.4 }],
    }));
    return <Animated.Text pointerEvents="none" style={[styles.burst, style]}>{emoji}</Animated.Text>;
}

/**
 * A day, opened: its cards dealt into a stack, one at a time (swipe left for
 * the next, right to go back, or tap a side), segments at the top for where
 * you are. Under each card, a row of emoji: tap one to put it on that card
 * (it flies up as you do), again to take it back; the counts show what
 * everyone said. Your own day shows the counts without the bar.
 */
export function DayViewer({ pages, owner, postUser, day, mine, onClose }: {
    pages: PackPage[];
    /** "Your day", "Sam's day". */
    owner: string;
    postUser: string;
    day: string;
    mine: boolean;
    onClose: () => void;
}) {
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const { selectionFeedback, lightFeedback, mediumFeedback } = useHaptics();
    const [index, setIndex] = useState(0);
    const [reactions, setReactions] = useState<CardReactions>({});
    const [bursts, setBursts] = useState<{ id: number; emoji: string }[]>([]);
    const cardWidth = width - Spacing.xl * 2;
    const cardHeight = Math.min(cardWidth * 1.35, height * 0.6);
    const tx = useSharedValue(0);
    const throwAt = width * 0.28;

    useEffect(() => { void cardReactions(postUser, day).then(setReactions); }, [postUser, day]);
    useEffect(() => { tx.set(0); }, [index, tx]);
    // The deal plays once, as the deck opens.
    const [dealt, setDealt] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setDealt(true), DURATION.reward + 200); return () => clearTimeout(timer); }, []);

    const go = (next: number) => {
        if (next < 0 || next >= pages.length) { tx.set(withTiming(0, { duration: DURATION.quick, easing: EASE.move })); return; }
        selectionFeedback();
        setIndex(next);
    };
    const pan = Gesture.Pan()
        .activeOffsetX([-12, 12])
        .onUpdate(event => { tx.set(event.translationX); })
        .onEnd(event => {
            const ahead = event.translationX < -throwAt || event.velocityX < -900;
            const back = event.translationX > throwAt || event.velocityX > 900;
            if (ahead && index < pages.length - 1) {
                tx.set(withTiming(-width * 1.5, { duration: DURATION.base, easing: EASE.exit }, done => { if (done) runOnJS(go)(index + 1); }));
            } else if (back && index > 0) {
                tx.set(withTiming(width * 1.5, { duration: DURATION.base, easing: EASE.exit }, done => { if (done) runOnJS(go)(index - 1); }));
            } else {
                tx.set(withTiming(0, { duration: DURATION.quick, easing: EASE.move }));
            }
        });
    const topStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tx.get() }, { rotate: `${interpolate(tx.get(), [-width, 0, width], [-14, 0, 14])}deg` }],
    }));
    const underStyle = useAnimatedStyle(() => {
        const pulled = Math.min(1, Math.abs(tx.get()) / throwAt);
        return { transform: [{ translateY: Spacing.lg * (1 - pulled) }, { scale: 0.94 + 0.06 * pulled }], opacity: 0.6 + 0.4 * pulled };
    });

    const current = pages[index];
    const under = pages[index + 1];
    const third = pages[index + 2];
    const here = reactions[current.key] ?? { counts: {}, mine: null };
    const react = (emoji: string) => {
        const next = here.mine === emoji ? null : emoji;
        if (next) { mediumFeedback(); setBursts(list => [...list, { id: Date.now(), emoji }]); } else lightFeedback();
        setReactions(state => withMine(state, current.key, next));
        void reactToCard(postUser, day, current.key, next);
    };
    const said = Object.entries(here.counts).sort((a, b) => b[1] - a[1]);

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <GestureHandlerRootView style={StyleSheet.absoluteFill}>
                <Animated.View entering={FadeIn.duration(DURATION.base).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(DURATION.exit)}
                    style={[StyleSheet.absoluteFill, { backgroundColor: `${Colors.common.black}EB` }]} />
                <View style={[styles.head, { paddingTop: insets.top + Spacing.sm }]}>
                    <View style={styles.flex}>
                        <RNText style={[t.type.title, { color: Colors.common.white }]}>{owner}</RNText>
                        <RNText style={[t.type.caption, { color: `${Colors.common.white}B3` }]}>{`${index + 1} of ${pages.length}`}</RNText>
                    </View>
                    <IconButton icon="close" label="Close" onPress={() => { lightFeedback(); onClose(); }} />
                </View>
                <View style={styles.segments}>
                    {pages.map((page, position) => (
                        <View key={page.key} style={[styles.segment, { backgroundColor: Colors.common.white, opacity: position <= index ? 0.95 : 0.3 }]} />
                    ))}
                </View>

                <View style={styles.table}>
                    {third ? (
                        <Animated.View key={`3-${third.key}`} style={[styles.layer, { transform: [{ translateY: Spacing.lg * 2 }, { scale: 0.88 }], opacity: 0.35 }]}
                            entering={dealt ? undefined : FadeInDown.delay(160).duration(DURATION.reward).easing(EASE.enter).reduceMotion(ReduceMotion.System)}>
                            {third.render(cardWidth, cardHeight)}
                        </Animated.View>
                    ) : null}
                    {under ? (
                        <Animated.View key={`2-${under.key}`} style={[styles.layer, underStyle]}
                            entering={dealt ? undefined : FadeInDown.delay(80).duration(DURATION.reward).easing(EASE.enter).reduceMotion(ReduceMotion.System)}>
                            {under.render(cardWidth, cardHeight)}
                        </Animated.View>
                    ) : null}
                    <GestureDetector gesture={pan}>
                        <Animated.View key={`1-${current.key}`} style={[styles.layer, topStyle]}
                            entering={dealt ? undefined : FadeInDown.duration(DURATION.reward).easing(EASE.enter).reduceMotion(ReduceMotion.System)}>
                            <Pressable onPress={event => go(index + (event.nativeEvent.locationX > cardWidth * 0.35 ? 1 : -1))}
                                accessible accessibilityRole="adjustable" accessibilityLabel={`${current.label}. Card ${index + 1} of ${pages.length}`}
                                accessibilityActions={[{ name: 'increment', label: 'Next card' }, { name: 'decrement', label: 'Previous card' }]}
                                onAccessibilityAction={event => go(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
                                {current.render(cardWidth, cardHeight)}
                            </Pressable>
                        </Animated.View>
                    </GestureDetector>
                </View>

                {/* What everyone said on this card, then your emoji. */}
                <View style={[styles.foot, { paddingBottom: insets.bottom + Spacing.lg }]}>
                    {said.length ? (
                        <View style={styles.said} accessible accessibilityLabel={said.map(([emoji, count]) => `${emoji} ${count}`).join(', ')}>
                            {said.map(([emoji, count]) => (
                                <View key={emoji} style={[styles.count, { backgroundColor: `${Colors.common.white}1F` }]}>
                                    <RNText style={t.type.body}>{emoji}</RNText>
                                    <RNText style={[t.type.caption, { color: Colors.common.white }]}>{count}</RNText>
                                </View>
                            ))}
                        </View>
                    ) : null}
                    {mine ? (
                        <RNText style={[t.type.caption, { color: `${Colors.common.white}99` }]}>{index < pages.length - 1 ? 'Swipe for the next' : 'That’s the day'}</RNText>
                    ) : (
                        <View style={styles.bar}>
                            {CARD_EMOJI.map(emoji => (
                                <Pressable key={emoji} onPress={() => react(emoji)} accessibilityRole="button" accessibilityState={{ selected: here.mine === emoji }}
                                    accessibilityLabel={`React ${emoji}`} hitSlop={Spacing.xs}
                                    style={[styles.emoji, here.mine === emoji && { backgroundColor: `${Colors.common.white}33` }]}>
                                    <RNText style={styles.emojiText}>{emoji}</RNText>
                                </Pressable>
                            ))}
                        </View>
                    )}
                    {bursts.map(burst => (
                        <Burst key={burst.id} emoji={burst.emoji} onDone={() => setBursts(list => list.filter(item => item.id !== burst.id))} />
                    ))}
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl },
    segments: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
    segment: { flex: 1, height: 3, borderRadius: Radius.pill },
    table: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    layer: { position: 'absolute' },
    foot: { alignItems: 'center', gap: Spacing.md },
    said: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm },
    count: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs / 2, borderRadius: Radius.pill },
    bar: { flexDirection: 'row', gap: Spacing.sm },
    emoji: { width: Spacing.section + Spacing.md, height: Spacing.section + Spacing.md, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    emojiText: { fontSize: Spacing.xxl },
    burst: { position: 'absolute', bottom: Spacing.section * 2, fontSize: Spacing.section },
});
