import React, { useState } from 'react';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';
import { MatteSurface } from './MatteSurface';
import { AppIcon } from './AppIcon';
import { Divider } from './Divider';
import { Text } from './Text';
import { ProgressRing } from './ProgressRing';

export interface PostStat { icon: string; value: string; label: string }

/**
 * One post in Community's feed, of any kind. The same frame every time, so
 * the feed reads calmly, with the middle telling the kinds apart:
 *
 *   header   a face (with status), a name, a rank, the kind with its icon,
 *            and the score, top right: how much of the day got done
 *   hero     the one number that matters, large
 *   visual   the contest, bar or chart that shows it
 *   stats    a few small figures (streak, focus, goals)
 *   details  more, on demand: a tap on the chevron
 *   footer   reactions, or the one thing to do about it (Rematch, See the race)
 *
 * A long press reports someone else's post; VoiceOver gets it as an action.
 */
export function PostCard({ lead, name, badge, rank, kind, when, live, score, hero, children, stats, details, detailsLabel, footer, onOpenAuthor, onReport }: {
    lead: React.ReactNode;
    name: string;
    /** Beside the name: a small mark of who they are. */
    badge?: React.ReactNode;
    /** Their place among friends this week. */
    rank?: number | null;
    kind: { icon: string; label: string };
    when?: string;
    /** A contest still running: a cobalt dot and "Live". */
    live?: boolean;
    /** The day's score, 0 to 1: a ring with the percentage, top right. */
    score?: number;
    hero?: React.ReactNode;
    children?: React.ReactNode;
    stats?: PostStat[];
    details?: React.ReactNode;
    /** What the details are, said beside the chevron ("12 more"), so it is clear what opens. */
    detailsLabel?: string;
    footer?: React.ReactNode;
    onOpenAuthor?: () => void;
    onReport?: () => void;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [open, setOpen] = useState(false);
    const meta = [kind.label, when].filter(Boolean).join(' · ');
    return (
        <MatteSurface radius={Radius.card} style={styles.card}>
            <Pressable style={styles.body} onLongPress={onReport} delayLongPress={450}
                accessibilityActions={onReport ? [{ name: 'report', label: 'Report' }] : undefined}
                onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'report') onReport?.(); }}>
                <View style={styles.head}>
                    {onOpenAuthor ? (
                        <Pressable onPress={onOpenAuthor} accessibilityRole="button" accessibilityLabel={`${name}'s profile`}>{lead}</Pressable>
                    ) : lead}
                    <View style={styles.grow}>
                        <View style={styles.nameRow}>
                            <Text variant="heading" numberOfLines={1}>{name}</Text>
                            {badge}
                            {rank ? <Text variant="caption" tone="muted" numeric>{`#${rank}`}</Text> : null}
                        </View>
                        <View style={styles.kind}>
                            <AppIcon name={kind.icon} filled size={Spacing.md} color={t.color.cobalt} />
                            <Text variant="caption" tone="muted" numberOfLines={1}>{meta}</Text>
                        </View>
                    </View>
                    {live ? (
                        <View style={[styles.live, { backgroundColor: t.tint('subtle', t.color.cobalt) }]} accessible accessibilityLabel="Live">
                            <View style={[styles.dot, { backgroundColor: t.color.cobalt }]} />
                            <RNText style={[t.type.caption, { color: t.color.cobalt }]}>Live</RNText>
                        </View>
                    ) : null}
                    {score !== undefined ? (
                        <ProgressRing size="sm" progress={score} label={`${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`}
                            accessibilityLabel={`Day score ${Math.round(Math.max(0, Math.min(1, score)) * 100)} percent`} />
                    ) : null}
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

                {footer ? <><Divider />{footer}</> : null}
            </Pressable>
        </MatteSurface>
    );
}

const styles = StyleSheet.create({
    card: { marginBottom: Spacing.md },
    body: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    grow: { flex: 1, gap: Spacing.xs / 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    kind: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    live: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
    dot: { width: Spacing.xs + 2, height: Spacing.xs + 2, borderRadius: Radius.pill },
    stats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    stat: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
    more: { marginLeft: 'auto', minWidth: Control.hitTarget - Spacing.md, height: Control.hitTarget - Spacing.md, flexDirection: 'row', gap: Spacing.xs, alignItems: 'center', justifyContent: 'center' },
    details: { gap: Spacing.sm },
});
