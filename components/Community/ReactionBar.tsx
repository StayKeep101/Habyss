import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AppIcon, Avatar, CountUp, MatteSurface, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE } from '@/theme/motion';
import { REACTIONS, reactionLabel, type Reaction } from '@/lib/reactions';
import type { ColorRoles } from '@/theme/tokens';

/** Someone who reacted, with the reaction they gave when it is known. */
export interface ReactionFace { name: string; avatarUrl?: string; reaction?: Reaction }

const FACE = Spacing.xxl + Spacing.xs;
/** The reaction worn on a face: a small disc on its bottom-right corner, never over the photo. */
const WORN = Math.round(FACE * 0.46);
/** Each reaction's own colour, from the theme. */
const TONE: Record<Reaction, keyof ColorRoles> = { proud: 'danger', fire: 'warning', comeback: 'cobalt', again: 'success' };
const iconOf = (id: Reaction) => REACTIONS.find(item => item.id === id)?.icon ?? 'heart';

/**
 * The four reactions under a friend's day, as pills with their icon in its
 * own colour (a red heart, an amber flame, a cobalt rocket, a green repeat)
 * and how many each got. Yours sits in a cobalt-tinted pill with a cobalt
 * edge and swells once as you pick it (no bounce). Tap another to change it,
 * tap yours to take it back. At the front, the faces of who reacted, each with
 * the one they gave on its bottom-right corner. On your own post, only those.
 */
export function ReactionBar({ mine, myReaction, reactions, faces, onReact, extra }: {
    mine: boolean;
    myReaction: Reaction | null;
    reactions: Partial<Record<Reaction, number>>;
    faces: ReactionFace[];
    onReact: (reaction: Reaction | null) => void;
    /** Another control at the end of the row: the comments button. */
    extra?: React.ReactNode;
}) {
    const t = useTokens();
    const pop = useSharedValue(1);
    useEffect(() => {
        if (myReaction) pop.set(withSequence(
            withTiming(1.12, { duration: DURATION.tap, easing: EASE.enter, reduceMotion: ReduceMotion.System }),
            withTiming(1, { duration: DURATION.quick, easing: EASE.move, reduceMotion: ReduceMotion.System })));
    }, [myReaction, pop]);
    const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
    const total = Object.values(reactions).reduce((sum, n) => sum + (n ?? 0), 0);
    const shown = mine ? REACTIONS.filter(option => (reactions[option.id] ?? 0) > 0) : REACTIONS;
    const said = faces.map(face => `${face.name}${face.reaction ? ` ${reactionLabel(face.reaction)}` : ''}`).join(', ');

    return (
        <View style={styles.row}>
            {faces.length ? (
                <View style={styles.faces} accessible accessibilityLabel={`${total} ${total === 1 ? 'reaction' : 'reactions'}: ${said}`}>
                    {faces.slice(0, 4).map((face, index) => (
                        <View key={`${face.name}-${index}`} style={[styles.face, { marginLeft: index ? Spacing.xs : 0 }]}>
                            <Avatar name={face.name} uri={face.avatarUrl} size={FACE} />
                            {face.reaction ? (
                                <View style={[styles.worn, { backgroundColor: t.color.surface, borderColor: t.color.surface }]}>
                                    <AppIcon name={iconOf(face.reaction)} filled size={WORN - Spacing.xs} color={t.color[TONE[face.reaction]]} />
                                </View>
                            ) : null}
                        </View>
                    ))}
                    {faces.length > 4 ? <Text variant="caption" tone="muted" numeric>{` +${faces.length - 4}`}</Text> : null}
                </View>
            ) : mine ? <Text variant="caption" tone="muted">No reactions yet</Text> : null}
            <View style={styles.pills}>
                {shown.map(option => {
                    const on = myReaction === option.id;
                    const count = reactions[option.id] ?? 0;
                    const inner = (
                        <>
                            <AppIcon name={option.icon} filled size={Spacing.lg} color={t.color[TONE[option.id]]} />
                            {/* The count ticks over as a reaction lands, like a balance. */}
                            {count ? <CountUp value={count} style={[t.type.caption, styles.count, { color: on ? t.color.textPrimary : t.color.textMuted }]} /> : null}
                        </>
                    );
                    // Picked: a cobalt tint with a cobalt edge, the emoji still in full colour.
                    const pill = on ? (
                        <View style={[styles.pill, styles.picked, { backgroundColor: t.tint('soft', t.color.cobalt), borderColor: t.color.cobalt }]}>{inner}</View>
                    ) : (
                        <MatteSurface radius={Radius.pill} level="control" style={styles.pill}>{inner}</MatteSurface>
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
    faces: { flexDirection: 'row', alignItems: 'center' },
    face: { width: FACE, height: FACE },
    worn: {
        position: 'absolute', right: -WORN / 3, bottom: -WORN / 3,
        width: WORN + Spacing.xs / 2, height: WORN + Spacing.xs / 2, borderRadius: WORN, borderWidth: Spacing.xs / 4,
        alignItems: 'center', justifyContent: 'center',
    },
    pills: { flexDirection: 'row', gap: Spacing.sm, marginLeft: 'auto' },
    pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, minWidth: Control.hitTarget - Spacing.xs, minHeight: Control.hitTarget - Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radius.pill },
    picked: { borderWidth: StyleSheet.hairlineWidth * 2 },
    count: { fontVariant: ['tabular-nums'] },
});
