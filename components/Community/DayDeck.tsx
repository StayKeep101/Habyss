import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, Text as RNText, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    FadeIn, FadeInDown, FadeOut, ReduceMotion, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, IconButton, MatteSurface, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { Colors } from '@/theme/colors';
import { DURATION, EASE } from '@/theme/motion';
import { Radius, Spacing } from '@/theme/designSystem';
import type { DeckCard } from '@/lib/dayDeck';
import { DeckCardFace } from './DeckCardFace';

/** How the three cards on top of the deck lean in the closed stack. */
const FAN = [{ rotate: -8, x: -Spacing.lg }, { rotate: 6, x: Spacing.lg }, { rotate: 0, x: 0 }];
const THUMB = { width: Spacing.section * 2, height: Spacing.section * 2.6 };

/**
 * A friend's day as a deck of cards, on their post: the top three fanned,
 * how many there are, and a tap to open it. Open, the cards rise into a stack
 * one after another, and you swipe through them one at a time
 * (components/Community/DeckCardFace.tsx): left for the next, right to go
 * back; or tap the sides. Nothing moves on by itself.
 */
export function DayDeck({ cards, owner }: { cards: DeckCard[]; owner: string }) {
    const t = useTokens();
    const { mediumFeedback } = useHaptics();
    const [open, setOpen] = useState(false);
    if (!cards.length) return null;
    const top = cards.slice(0, 3).reverse();
    const photos = cards.filter(card => card.photo).length;
    return (
        <>
            <Pressable onPress={() => { mediumFeedback(); setOpen(true); }} accessibilityRole="button"
                accessibilityLabel={`Open ${owner} day, ${cards.length} card${cards.length > 1 ? 's' : ''}`}>
                <MatteSurface radius={Radius.card} level="control" style={styles.preview}>
                    <View style={styles.stack}>
                        {top.map((card, layer) => {
                            const fan = FAN[layer + (3 - top.length)];
                            return (
                                <View key={card.key} style={[styles.thumb, { transform: [{ translateX: fan.x }, { rotate: `${fan.rotate}deg` }] }]}>
                                    {card.photo ? <Image source={{ uri: card.photo }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
                                        : (
                                            <View style={[StyleSheet.absoluteFill, styles.thumbFace, { backgroundColor: t.color.surfaceRaised }]}>
                                                <AppIcon name={card.kind === 'task' ? 'checkbox' : 'repeat'} filled size={Spacing.lg} color={t.color.accent} />
                                            </View>
                                        )}
                                </View>
                            );
                        })}
                    </View>
                    <View style={styles.previewText}>
                        <Text variant="heading">{`${cards.length} card${cards.length > 1 ? 's' : ''}`}</Text>
                        <Text variant="caption" tone="muted">{photos ? `${photos} photo${photos > 1 ? 's' : ''} · tap to open` : 'Tap to open'}</Text>
                    </View>
                    <AppIcon name="chevron-forward" size={Spacing.lg} color={t.color.textSubtle} />
                </MatteSurface>
            </Pressable>
            {open ? <DeckViewer cards={cards} owner={owner} onClose={() => setOpen(false)} /> : null}
        </>
    );
}

function DeckViewer({ cards, owner, onClose }: { cards: DeckCard[]; owner: string; onClose: () => void }) {
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const { selectionFeedback, lightFeedback } = useHaptics();
    const [index, setIndex] = useState(0);
    const cardWidth = width - Spacing.xl * 2;
    const cardHeight = Math.min(cardWidth * 1.4, height * 0.64);
    const tx = useSharedValue(0);
    const throwAt = width * 0.28;

    useEffect(() => { tx.set(0); }, [index, tx]);
    // The deal plays once, as the deck opens; after that cards just move up.
    const [dealt, setDealt] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setDealt(true), DURATION.reward + 200); return () => clearTimeout(timer); }, []);
    const go = (next: number) => {
        if (next < 0 || next >= cards.length) { tx.set(withTiming(0, { duration: DURATION.quick, easing: EASE.move })); return; }
        selectionFeedback();
        setIndex(next);
    };
    const pan = Gesture.Pan()
        .activeOffsetX([-12, 12])
        .onUpdate(event => { tx.set(event.translationX); })
        .onEnd(event => {
            const ahead = event.translationX < -throwAt || event.velocityX < -900;
            const back = event.translationX > throwAt || event.velocityX > 900;
            if (ahead && index < cards.length - 1) {
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
    // The card under it rises as the top one is pulled away.
    const underStyle = useAnimatedStyle(() => {
        const pulled = Math.min(1, Math.abs(tx.get()) / throwAt);
        return { transform: [{ translateY: Spacing.lg * (1 - pulled) }, { scale: 0.94 + 0.06 * pulled }], opacity: 0.6 + 0.4 * pulled };
    });

    const current = cards[index];
    const under = cards[index + 1];
    const third = cards[index + 2];
    const label = (card: DeckCard) => [card.kind === 'task' ? 'Task' : card.kind === 'habit' ? 'Habit' : null, card.title,
        card.planned ? `planned ${card.planned}` : null, card.took ? `took ${card.took}` : null, card.verdict?.text, card.when].filter(Boolean).join(', ');

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <GestureHandlerRootView style={StyleSheet.absoluteFill}>
                <Animated.View entering={FadeIn.duration(DURATION.base).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(DURATION.exit)}
                    style={[StyleSheet.absoluteFill, { backgroundColor: `${Colors.common.black}EB` }]} />
                <View style={[styles.head, { paddingTop: insets.top + Spacing.sm }]}>
                    <View style={styles.flex}>
                        <RNText style={[t.type.title, { color: Colors.common.white }]}>{`${owner} day`}</RNText>
                        <RNText style={[t.type.caption, { color: `${Colors.common.white}B3` }]}>{`${index + 1} of ${cards.length}`}</RNText>
                    </View>
                    <IconButton icon="close" label="Close" onPress={() => { lightFeedback(); onClose(); }} />
                </View>
                {/* Which one, of how many. */}
                <View style={styles.segments}>
                    {cards.map((card, position) => (
                        <View key={card.key} style={[styles.segment, { backgroundColor: Colors.common.white, opacity: position <= index ? 0.95 : 0.3 }]} />
                    ))}
                </View>

                <View style={styles.table}>
                    {third ? (
                        <Animated.View key={`3-${third.key}`} style={[styles.layer, { transform: [{ translateY: Spacing.lg * 2 }, { scale: 0.88 }], opacity: 0.35 }]}
                            entering={dealt ? undefined : FadeInDown.delay(160).duration(DURATION.reward).easing(EASE.enter).reduceMotion(ReduceMotion.System)}>
                            <DeckCardFace card={third} width={cardWidth} height={cardHeight} />
                        </Animated.View>
                    ) : null}
                    {under ? (
                        <Animated.View key={`2-${under.key}`} style={[styles.layer, underStyle]}
                            entering={dealt ? undefined : FadeInDown.delay(80).duration(DURATION.reward).easing(EASE.enter).reduceMotion(ReduceMotion.System)}>
                            <DeckCardFace card={under} width={cardWidth} height={cardHeight} />
                        </Animated.View>
                    ) : null}
                    <GestureDetector gesture={pan}>
                        <Animated.View key={`1-${current.key}`} style={[styles.layer, topStyle]}
                            entering={dealt ? undefined : FadeInDown.duration(DURATION.reward).easing(EASE.enter).reduceMotion(ReduceMotion.System)}>
                            <Pressable onPress={event => go(index + (event.nativeEvent.locationX > cardWidth * 0.35 ? 1 : -1))}
                                accessible accessibilityRole="adjustable" accessibilityLabel={label(current)}
                                accessibilityActions={[{ name: 'increment', label: 'Next card' }, { name: 'decrement', label: 'Previous card' }]}
                                onAccessibilityAction={event => go(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
                                <DeckCardFace card={current} width={cardWidth} height={cardHeight} />
                            </Pressable>
                        </Animated.View>
                    </GestureDetector>
                </View>

                <View style={[styles.foot, { paddingBottom: insets.bottom + Spacing.lg }]}>
                    <RNText style={[t.type.caption, { color: `${Colors.common.white}99` }]}>
                        {index < cards.length - 1 ? 'Swipe for the next' : 'That’s the day'}
                    </RNText>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    preview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    stack: { width: THUMB.width + Spacing.section, height: THUMB.height + Spacing.sm, alignItems: 'center', justifyContent: 'center' },
    thumb: { position: 'absolute', width: THUMB.width, height: THUMB.height, borderRadius: Radius.small, overflow: 'hidden' },
    thumbFace: { alignItems: 'center', justifyContent: 'center' },
    previewText: { flex: 1, gap: Spacing.xs },
    head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl },
    segments: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
    segment: { flex: 1, height: 3, borderRadius: Radius.pill },
    table: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    layer: { position: 'absolute' },
    foot: { alignItems: 'center' },
});
