import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { Control, Spacing } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';
import { AppIcon } from './AppIcon';
import { Text } from './Text';
import type { PostStat } from './PostCard';

/**
 * A post in the Timeline's language: no card around it, the author's face a
 * node on a spine that runs down the feed, and the day beside it, the way a
 * habit sits on the Timeline. The same parts as PostCard (header, hero, the
 * day, stats, more on demand, footer), so a feed can switch frames without
 * changing what it says. A long press reports someone else's post.
 */
export function TimelinePost({ lead, name, rank, when, hero, children, stats, details, detailsLabel, footer, onOpenAuthor, onReport, last }: {
    /** The face on the spine. */
    lead: React.ReactNode;
    name: string;
    /** Their place among friends this week. */
    rank?: number | null;
    when?: string;
    hero?: React.ReactNode;
    children?: React.ReactNode;
    stats?: PostStat[];
    details?: React.ReactNode;
    detailsLabel?: string;
    footer?: React.ReactNode;
    onOpenAuthor?: () => void;
    onReport?: () => void;
    /** The last post: the spine stops at its face. */
    last?: boolean;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [open, setOpen] = useState(false);
    return (
        <View style={styles.row}>
            {/* The spine: the face, and the line on to the next day. */}
            <View style={styles.rail}>
                {onOpenAuthor ? (
                    <Pressable onPress={onOpenAuthor} accessibilityRole="button" accessibilityLabel={`${name}'s profile`}>{lead}</Pressable>
                ) : lead}
                {last ? null : <View style={[styles.spine, { backgroundColor: t.color.border }]} />}
            </View>

            <Pressable style={styles.body} onLongPress={onReport} delayLongPress={450}
                accessibilityActions={onReport ? [{ name: 'report', label: 'Report' }] : undefined}
                onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'report') onReport?.(); }}>
                <View style={styles.head}>
                    <View style={styles.nameRow}>
                        <Text variant="heading" numberOfLines={1}>{name}</Text>
                        {rank ? <Text variant="caption" tone="muted" numeric>{`#${rank}`}</Text> : null}
                    </View>
                    {when ? <Text variant="caption" tone="muted" numberOfLines={1}>{when}</Text> : null}
                </View>

                {hero}
                {children}

                {stats?.length || details ? (
                    <View style={styles.stats}>
                        {(stats ?? []).map(stat => (
                            <View key={stat.label} style={styles.stat} accessible accessibilityLabel={`${stat.value} ${stat.label}`}>
                                <AppIcon name={stat.icon} size={Spacing.md + 2} color={t.color.silver} />
                                <Text variant="bodySmall" numeric>{stat.value}</Text>
                                <Text variant="caption" tone="muted">{stat.label}</Text>
                            </View>
                        ))}
                        {details ? (
                            <Pressable onPress={() => { selectionFeedback(); setOpen(value => !value); }} hitSlop={Spacing.md}
                                style={styles.more} accessibilityRole="button" accessibilityState={{ expanded: open }}
                                accessibilityLabel={open ? `Hide ${detailsLabel ?? 'details'}` : `Show ${detailsLabel ?? 'details'}`}>
                                {detailsLabel ? <Text variant="caption" tone="muted">{detailsLabel}</Text> : null}
                                <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={Control.icon - 2} color={t.color.textMuted} />
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}
                {details && open ? (
                    <Animated.View entering={FadeIn.duration(DURATION.base).reduceMotion(ReduceMotion.System)}
                        exiting={FadeOut.duration(DURATION.exit).reduceMotion(ReduceMotion.System)} style={styles.details}>
                        {details}
                    </Animated.View>
                ) : null}

                {footer}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.md },
    rail: { alignItems: 'center', width: Control.hitTarget },
    spine: { flex: 1, width: 2, borderRadius: 1, marginTop: Spacing.sm, marginBottom: -Spacing.sm },
    body: { flex: 1, gap: Spacing.md, paddingBottom: Spacing.section },
    head: { gap: Spacing.xs / 2, minHeight: Control.hitTarget, justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    stats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, flexWrap: 'wrap' },
    stat: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
    more: { marginLeft: 'auto', minWidth: Control.hitTarget - Spacing.md, height: Control.hitTarget - Spacing.md, flexDirection: 'row', gap: Spacing.xs, alignItems: 'center', justifyContent: 'center' },
    details: { gap: Spacing.sm },
});
