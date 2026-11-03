import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AppIcon, Avatar, CountUp, MatteSurface, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { textOn } from '@/theme/tokens';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE } from '@/theme/motion';
import { REACTIONS, reactionLabel, type Reaction } from '@/lib/reactions';

/**
 * The four reactions under a friend's day, as small pills with how many each
 * got; yours is filled in cobalt and swells once as you pick it (no bounce).
 * Tap another to change it, tap yours to take it back. Faces of who reacted
 * sit at the front. On your own post, only who reacted.
 */
export function ReactionBar({ mine, myReaction, reactions, faces, onReact, extra }: {
    mine: boolean;
    myReaction: Reaction | null;
    reactions: Partial<Record<Reaction, number>>;
    faces: { name: string; avatarUrl?: string }[];
    onReact: (reaction: Reaction | null) => void;
    /** Another control at the end of the row: the comments button. */
    extra?: React.ReactNode;
}) {
    const t = useTokens();
    const pop = useSharedValue(1);
    useEffect(() => {
        if (myReaction) pop.set(withSequence(
            withTiming(1.08, { duration: DURATION.tap, easing: EASE.enter, reduceMotion: ReduceMotion.System }),
            withTiming(1, { duration: DURATION.quick, easing: EASE.move, reduceMotion: ReduceMotion.System })));
    }, [myReaction, pop]);
    const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
    const total = Object.values(reactions).reduce((sum, n) => sum + (n ?? 0), 0);
    const shown = mine ? REACTIONS.filter(option => (reactions[option.id] ?? 0) > 0) : REACTIONS;

    return (
        <View style={styles.row}>
            {faces.length ? (
                <View style={styles.faces} accessible accessibilityLabel={`${total} ${total === 1 ? 'reaction' : 'reactions'}`}>
                    {faces.slice(0, 3).map((face, index) => (
                        <Avatar key={`${face.name}-${index}`} name={face.name} uri={face.avatarUrl} size={Spacing.xxl}
                            style={{ marginLeft: index ? -Spacing.sm : 0 }} />
                    ))}
                </View>
            ) : mine ? <Text variant="caption" tone="muted">No reactions yet</Text> : null}
            <View style={styles.pills}>
                {shown.map(option => {
                    const on = myReaction === option.id;
                    const count = reactions[option.id] ?? 0;
                    const fg = on ? textOn(t.color.cobalt) : t.color.textPrimary;
                    const pill = (
                        <MatteSurface radius={Radius.pill} level="control" style={[styles.pill, on && { backgroundColor: t.color.cobalt }]}>
                            <AppIcon name={option.icon} filled={on} size={Spacing.lg} color={on ? fg : t.color.silver} />
                            {/* The count ticks over as a reaction lands, like a balance. */}
                            {count ? <CountUp value={count} style={[t.type.caption, styles.count, { color: fg }]} /> : null}
                        </MatteSurface>
                    );
                    if (mine) return <View key={option.id} accessible accessibilityLabel={`${reactionLabel(option.id)} ${count}`}>{pill}</View>;
                    return (
                        <Pressable key={option.id} onPress={() => onReact(on ? null : option.id)} hitSlop={Spacing.xs}
                            accessibilityRole="button" accessibilityState={{ selected: on }}
                            accessibilityLabel={`${option.label}${count ? `, ${count}` : ''}`}
                            accessibilityHint={on ? 'Takes your reaction back' : undefined}>
                            {on ? <Animated.View style={popStyle}>{pill}</Animated.View> : pill}
                        </Pressable>
                    );
                })}
                {extra}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    faces: { flexDirection: 'row' },
    pills: { flexDirection: 'row', gap: Spacing.sm, marginLeft: 'auto' },
    pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, minWidth: Control.hitTarget - Spacing.xs, minHeight: Control.hitTarget - Spacing.xs, paddingHorizontal: Spacing.md },
    count: { fontVariant: ['tabular-nums'] },
});
