import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { FaceStack } from '@/components/ui/FaceStack';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { namesLine } from '@/lib/focusTogether';

const FACE = 28;

/**
 * Who is focusing with you, under the name on the focus page: their faces,
 * overlapping, and "With Alex and Sam". One friend on something else of
 * their own reads "while Maya · Study bio" (you on Read business book). A
 * face arrives the moment a friend joins and leaves when they finish.
 * Nothing at all when you are alone, or a short `note` instead (after an
 * invite: "Invited 4 friends").
 */
export function FocusCrew({ crew, accent, note, mine }: {
    crew: { userId: string; name: string; avatarUrl?: string; focusLabel?: string | null }[];
    accent: string;
    note?: string | null;
    /** What you are focusing on, to tell a friend on something else. */
    mine?: string;
}) {
    if (crew.length === 0 && !note) return null;
    const only = crew.length === 1 ? crew[0] : null;
    const theirs = only?.focusLabel?.trim();
    const line = only && theirs && theirs.toLowerCase() !== mine?.trim().toLowerCase()
        ? `while ${only.name.split(' ')[0] || only.name} · ${theirs}`
        : crew.length > 0 ? `With ${namesLine(crew.map(friend => friend.name))}` : note;
    return (
        <Animated.View entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(250).reduceMotion(ReduceMotion.System)}
            layout={LinearTransition.reduceMotion(ReduceMotion.System)} style={styles.row}
            accessible accessibilityLabel={line ?? undefined} accessibilityLiveRegion="polite">
            <FaceStack faces={crew} size={FACE} ring={accent} />
            <Text numberOfLines={1} style={styles.text}>{line}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: FACE + 4 },
    // Over the focus page's black, like its other quiet lines.
    text: { fontFamily: FontFamily.semibold, fontSize: 15, color: 'rgba(255,255,255,0.75)', flexShrink: 1 },
});
