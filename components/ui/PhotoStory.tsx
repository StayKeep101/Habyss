import React, { useRef, useState } from 'react';
import { Image, Pressable, Text as RNText, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useHaptics } from '@/hooks/useHaptics';
import { Colors } from '@/theme/colors';
import { Radius, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';

export interface StoryPhoto { uri: string; caption?: string }

/**
 * Photos one at a time, like a story: thin segments across the top show how
 * many and which one; swipe, or tap the right or left of the photo, to go to
 * the next or the one before. Its caption sits on the photo, over a soft fade.
 * Never moves on by itself. VoiceOver steps through it with swipe up and down.
 */
export function PhotoStory({ photos, ratio = 4 / 5 }: { photos: StoryPhoto[]; ratio?: number }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [width, setWidth] = useState(0);
    const [index, setIndex] = useState(0);
    const scroller = useRef<ScrollView>(null);
    const white = Colors.common.white;

    const go = (next: number) => {
        const to = Math.max(0, Math.min(photos.length - 1, next));
        if (to === index) return;
        selectionFeedback();
        setIndex(to);
        scroller.current?.scrollTo({ x: to * width, animated: true });
    };

    if (!photos.length) return null;
    const current = photos[index];
    return (
        <View style={[styles.frame, { aspectRatio: ratio }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}
            accessible accessibilityRole="adjustable"
            accessibilityLabel={`Photo ${index + 1} of ${photos.length}${current?.caption ? `: ${current.caption}` : ''}`}
            accessibilityActions={[{ name: 'increment', label: 'Next photo' }, { name: 'decrement', label: 'Previous photo' }]}
            onAccessibilityAction={event => go(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
            {width ? (
                <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} bounces={false} style={StyleSheet.absoluteFill}
                    onMomentumScrollEnd={event => {
                        const next = Math.round(event.nativeEvent.contentOffset.x / width);
                        if (next !== index) { selectionFeedback(); setIndex(next); }
                    }}>
                    {photos.map((photo, position) => (
                        <Pressable key={`${photo.uri}-${position}`} style={{ width, height: width / ratio }}
                            onPress={event => go(index + (event.nativeEvent.locationX > width * 0.35 ? 1 : -1))}>
                            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                        </Pressable>
                    ))}
                </ScrollView>
            ) : null}

            {/* Which one, of how many: a segment each, lit up to this one. */}
            {photos.length > 1 ? (
                <View style={styles.segments} pointerEvents="none">
                    {photos.map((_, position) => (
                        <View key={position} style={[styles.segment, { backgroundColor: white, opacity: position <= index ? 0.95 : 0.35 }]} />
                    ))}
                </View>
            ) : null}

            {current?.caption ? (
                <View style={styles.captionArea} pointerEvents="none">
                    <LinearGradient colors={[`${Colors.common.black}00`, `${Colors.common.black}B3`]} style={StyleSheet.absoluteFill} />
                    <RNText numberOfLines={1} style={[t.type.heading, { color: white }]}>{current.caption}</RNText>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    frame: { width: '100%', borderRadius: Radius.card, overflow: 'hidden' },
    segments: { position: 'absolute', top: Spacing.sm, left: Spacing.sm, right: Spacing.sm, flexDirection: 'row', gap: Spacing.xs },
    segment: { flex: 1, height: 3, borderRadius: Radius.pill },
    captionArea: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.lg, paddingTop: Spacing.section, paddingBottom: Spacing.md },
});
