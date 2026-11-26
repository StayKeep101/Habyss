import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { usePagerGesture } from '@/components/ui/PagerGesture';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { DURATION, EASE } from '@/theme/motion';
import { Radius, Spacing } from '@/theme/designSystem';

/** The pager around the feed (components/ui/PagerGesture.ts): a swipe that starts on a card moves the cards. */
export { PagerGesture } from '@/components/ui/PagerGesture';

export interface PackPage {
    key: string;
    /** What VoiceOver reads for it. */
    label: string;
    /** Held: what it does (reporting a friend's day). */
    onLongPress?: () => void;
    render: (width: number, height: number) => React.ReactNode;
}

/**
 * A day as a pack of cards, right in the feed: the top one in full, the next
 * two peeking under it. Swipe left for the next card, right to go back (or
 * tap the right or left side); the card under it rises as the top one is
 * pulled away. A line of segments says which card, of how many.
 */
export function DayPack({ pages }: { pages: PackPage[] }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const pager = usePagerGesture();
    // The feed's width to start with (drawn on the first frame), then exactly what it is given.
    const screen = useWindowDimensions();
    const [width, setWidth] = useState(Math.max(0, screen.width - Spacing.xl * 2));
    const [index, setIndex] = useState(0);
    const height = Math.round(width * 1.05);
    const tx = useSharedValue(0);
    const throwAt = width * 0.28;

    const go = (next: number) => {
        tx.set(0);
        if (next < 0 || next >= pages.length) return;
        selectionFeedback();
        setIndex(next);
    };
    let pan = Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-10, 10])
        .onUpdate(event => {
            // Nothing past either end: the card resists.
            const edge = (event.translationX < 0 && index >= pages.length - 1) || (event.translationX > 0 && index <= 0);
            tx.set(edge ? event.translationX * 0.2 : event.translationX);
        })
        .onEnd(event => {
            const ahead = event.translationX < -throwAt || event.velocityX < -900;
            const back = event.translationX > throwAt || event.velocityX > 900;
            if (ahead && index < pages.length - 1) {
                tx.set(withTiming(-width * 1.4, { duration: DURATION.base, easing: EASE.exit }, done => { if (done) runOnJS(go)(index + 1); }));
            } else if (back && index > 0) {
                tx.set(withTiming(width * 1.4, { duration: DURATION.base, easing: EASE.exit }, done => { if (done) runOnJS(go)(index - 1); }));
            } else {
                tx.set(withTiming(0, { duration: DURATION.quick, easing: EASE.move }));
            }
        });
    if (pager) pan = pan.blocksExternalGesture(pager);

    const topStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tx.get() }, { rotate: `${interpolate(tx.get(), [-width || -1, 0, width || 1], [-10, 0, 10])}deg` }],
    }));
    const underStyle = useAnimatedStyle(() => {
        const pulled = Math.min(1, Math.abs(tx.get()) / Math.max(1, throwAt));
        return { transform: [{ translateY: Spacing.md * (1 - pulled) }, { scale: 0.95 + 0.05 * pulled }], opacity: 0.7 + 0.3 * pulled };
    });

    const current = pages[index];
    const under = pages[index + 1];
    const third = pages[index + 2];
    return (
        <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
            {width && current ? (
                <>
                    <View style={[styles.table, { height: height + Spacing.md * 2 }]}>
                        {third ? (
                            <View key={`3-${third.key}`} style={[styles.layer, { transform: [{ translateY: Spacing.md * 2 }, { scale: 0.9 }], opacity: 0.4 }]}>
                                {third.render(width, height)}
                            </View>
                        ) : null}
                        {under ? (
                            <Animated.View key={`2-${under.key}`} style={[styles.layer, underStyle]}>
                                {under.render(width, height)}
                            </Animated.View>
                        ) : null}
                        <GestureDetector gesture={pan}>
                            <Animated.View key={`1-${current.key}`} style={[styles.layer, topStyle]}>
                                <Pressable onPress={event => go(index + (event.nativeEvent.locationX > width * 0.4 ? 1 : -1))}
                                    onLongPress={current.onLongPress} delayLongPress={450}
                                    accessible accessibilityRole="adjustable" accessibilityLabel={`${current.label}. Card ${index + 1} of ${pages.length}`}
                                    accessibilityActions={[{ name: 'increment', label: 'Next card' }, { name: 'decrement', label: 'Previous card' }]}
                                    onAccessibilityAction={event => go(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
                                    {current.render(width, height)}
                                </Pressable>
                            </Animated.View>
                        </GestureDetector>
                    </View>
                    {pages.length > 1 ? (
                        <View style={styles.segments} importantForAccessibility="no-hide-descendants">
                            {pages.map((page, position) => (
                                <View key={page.key} style={[styles.segment, { backgroundColor: position === index ? t.color.accent : t.color.border }]} />
                            ))}
                        </View>
                    ) : null}
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    table: { alignItems: 'center' },
    layer: { position: 'absolute', top: 0 },
    segments: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center', paddingTop: Spacing.xs },
    segment: { width: Spacing.lg, height: Spacing.xs - 1, borderRadius: Radius.pill },
});
