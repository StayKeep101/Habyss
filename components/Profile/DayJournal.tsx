import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppButton, AppIcon, ListItem, SectionTitle, Text, VoidCard } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { FeedService, type FeedPost } from '@/lib/feedService';
import { Spacing } from '@/theme/designSystem';

const PAGE = 10;
const dateLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Your journal: every day card you have posted, newest first, as a diary. Each
 * day: its date, how much of it you got done, the streak, and your note on it;
 * tap one to read what you did and what you didn't get to. Nothing is stored
 * on the phone for it: the cards are read from your posts, ten at a time, as
 * you ask for more.
 */
export function DayJournal({ userId }: { userId: string }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [days, setDays] = useState<FeedPost[] | null>(null);
    const [more, setMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState<string | null>(null);

    const load = useCallback(async (before?: string) => {
        setLoading(true);
        const page = await FeedService.feed(before, PAGE, userId).catch(() => []);
        setDays(current => [...(before ? current ?? [] : []), ...page]);
        setMore(page.length === PAGE);
        setLoading(false);
    }, [userId]);
    useEffect(() => { void load(); }, [load]);

    if (!days?.length) return null;
    return (
        <View style={styles.wrap}>
            <SectionTitle first>Journal</SectionTitle>
            <VoidCard style={styles.card}>
                {days.map((post, index) => {
                    const card = post.card;
                    const done = card.habitsDone + card.tasksDone;
                    const total = card.habitsTotal + card.tasksTotal;
                    const lines = [...(card.top ?? []), ...(card.habits ?? []), ...(card.tasks ?? [])]
                        .filter((line, at, all) => all.findIndex(other => other.name === line.name) === at);
                    const isOpen = open === post.day;
                    return (
                        <ListItem key={post.day} index={index}>
                            <Pressable onPress={() => { selectionFeedback(); setOpen(isOpen ? null : post.day); }} accessibilityRole="button"
                                accessibilityState={{ expanded: isOpen }}
                                accessibilityLabel={`${dateLabel(post.day)}: ${done} of ${total} done${card.streak ? `, ${card.streak} day streak` : ''}${card.note ? `. ${card.note}` : ''}`}
                                style={[styles.day, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}>
                                <View style={styles.top}>
                                    <Text variant="heading" grow>{dateLabel(post.day)}</Text>
                                    {card.streak ? (
                                        <View style={styles.streak}>
                                            <AppIcon name="flame" filled size={Spacing.md + 2} color={t.color.warning} />
                                            <Text variant="caption" numeric>{String(card.streak)}</Text>
                                        </View>
                                    ) : null}
                                    <Text variant="bodySmall" tone="muted" numeric>{`${done}/${total}`}</Text>
                                    <AppIcon name={isOpen ? 'chevron-up' : 'chevron-down'} size={Spacing.md + 2} color={t.color.textSubtle} />
                                </View>
                                {card.note ? <Text variant="body" tone="muted" numberOfLines={isOpen ? undefined : 2}>{`“${card.note}”`}</Text> : null}
                                {isOpen ? (
                                    <View style={styles.lines}>
                                        {lines.map((line, at) => (
                                            <View key={`${line.name}-${at}`} style={styles.line}>
                                                <AppIcon name={line.done ? 'checkmark-circle' : 'ellipse-outline'} filled={line.done} size={Spacing.lg}
                                                    color={line.done ? t.color.accent : t.color.textSubtle} />
                                                <Text variant="bodySmall" tone={line.done ? 'primary' : 'muted'} grow numberOfLines={1}>{line.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                            </Pressable>
                        </ListItem>
                    );
                })}
            </VoidCard>
            {more ? (
                <AppButton label={loading ? 'Loading…' : 'Earlier days'} variant="ghost" loading={loading} disabled={loading}
                    onPress={() => { selectionFeedback(); void load(days[days.length - 1].postedAt); }} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    card: { paddingHorizontal: Spacing.lg },
    day: { paddingVertical: Spacing.md, gap: Spacing.xs, minHeight: Spacing.section + Spacing.sm },
    top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    streak: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs / 2 },
    lines: { gap: Spacing.xs, paddingTop: Spacing.xs },
    line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
