import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { namesLine } from '@/lib/focusTogether';

const FACE = 28;
const OVERLAP = 8;
const SHOWN = 4;

/**
 * Who is focusing with you, under the name on the focus page: their faces,
 * overlapping, and "With Alex and Sam". A face arrives the moment a friend
 * joins and leaves when they finish. Nothing at all when you are alone, or
 * a short `note` instead (after an invite: "Invited 4 friends").
 */
export function FocusCrew({ crew, accent, note }: {
    crew: { userId: string; name: string; avatarUrl?: string }[];
    accent: string;
    note?: string | null;
}) {
    if (crew.length === 0 && !note) return null;
    const line = crew.length > 0 ? `With ${namesLine(crew.map(friend => friend.name))}` : note;
    return (
        <Animated.View entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(250).reduceMotion(ReduceMotion.System)}
            layout={LinearTransition.reduceMotion(ReduceMotion.System)} style={styles.row}
            accessible accessibilityLabel={line ?? undefined} accessibilityLiveRegion="polite">
            {crew.length > 0 ? (
                <View style={[styles.faces, { width: FACE + (Math.min(crew.length, SHOWN) - 1) * (FACE - OVERLAP) }]}>
                    {crew.slice(0, SHOWN).map((friend, index) => (
                        <Animated.View key={friend.userId} entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
                            style={[styles.face, { left: index * (FACE - OVERLAP), zIndex: SHOWN - index }]}>
                            <Avatar name={friend.name} uri={friend.avatarUrl} size={FACE} ring={accent} />
                        </Animated.View>
                    ))}
                </View>
            ) : null}
            <Text numberOfLines={1} style={styles.text}>{line}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: FACE + 4 },
    faces: { height: FACE + 4 },
    face: { position: 'absolute', top: 0 },
    // Over the focus page's black, like its other quiet lines.
    text: { fontFamily: FontFamily.semibold, fontSize: 15, color: 'rgba(255,255,255,0.75)', flexShrink: 1 },
});
