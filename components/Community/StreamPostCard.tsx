import React from 'react';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import { AppIcon, Avatar, CountUp, MatteSurface, PopIn, PostCard, SegmentBar, Text, type PostStat } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { textOn } from '@/theme/tokens';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { maskObjectionable } from '@/lib/contentFilter';
import { focusDuration } from '@/lib/focusStats';
import { STREAK_MILESTONES } from '@/lib/dayMoments';
import type { StreamPost } from '@/lib/communityStream';
import type { DayCardLine } from '@/lib/dayCard';
import type { FeedPost } from '@/lib/feedService';
import type { FriendStatus } from '@/lib/presence';
import type { Reaction } from '@/lib/reactions';
import { bestComments, splitMentions, type Comment } from '@/lib/comments';
import { StatusBadge } from './StatusBadge';
import { DayDeck } from './DayDeck';
import { deckCards } from '@/lib/dayDeck';
import { ReactionBar } from './ReactionBar';

/** What a post needs from the page around it. */
export interface StreamContext {
    meId: string | null;
    myName: string;
    myAvatar?: string;
    rankOf: (userId: string) => number | null;
    statusOf: (userId: string) => FriendStatus | undefined;
    facesOf: (userIds: string[]) => { id: string; name: string; avatarUrl?: string }[];
    onReact: (post: FeedPost, reaction: Reaction | null) => void;
    onReport: (post: FeedPost) => void;
    openPerson: (userId: string) => void;
    /** The comments under a day, by its post key. */
    commentsOf: (key: string) => Comment[];
    onOpenComments: (post: FeedPost, write?: boolean) => void;
}

const postedLabel = (postedAt: string) => {
    const date = new Date(postedAt);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (date.toDateString() === today.toDateString()) return time;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/** The big figure and what it counts: "75%  of the day". */
function Hero({ value, unit, caption }: { value: string; unit?: string; caption?: string }) {
    const t = useTokens();
    return (
        <View style={styles.hero}>
            <CountUp value={value} style={[t.type.screenTitle, { color: t.color.textPrimary }]} />
            {unit ? <Text variant="body" tone="muted">{unit}</Text> : null}
            {caption ? <Text variant="caption" tone="muted" grow align="right" numberOfLines={1}>{caption}</Text> : null}
        </View>
    );
}

/** How long it took and who it was with: "45m · with Sam". Nothing when there is nothing to say. */
function LineFacts({ item }: { item: DayCardLine }) {
    const t = useTokens();
    const parts = [
        item.minutes ? focusDuration(item.minutes * 60) : null,
        item.with?.length ? `with ${item.with.join(', ')}` : null,
    ].filter(Boolean);
    if (!parts.length) return item.skipped ? <Text variant="caption" tone="muted">Skipped</Text> : null;
    return (
        <View style={styles.facts}>
            {item.minutes ? <AppIcon name="hourglass" size={Spacing.md} color={t.color.textSubtle} /> : item.with?.length ? <AppIcon name="people" size={Spacing.md} color={t.color.textSubtle} /> : null}
            <Text variant="caption" tone="muted" numberOfLines={1}>{parts.join(' · ')}</Text>
        </View>
    );
}

/**
 * One thing from the day: ticked, waiting (shared, and the others not done
 * yet: a minus, it does not count yet), skipped, or not done.
 */
function Line({ item, mine }: { item: DayCardLine; mine: boolean }) {
    const t = useTokens();
    return (
        <View style={styles.line}>
            <AppIcon name={item.done ? 'checkmark-circle' : item.waiting || item.skipped ? 'remove-circle' : 'ellipse-outline'} filled={item.done || item.waiting}
                size={Spacing.lg + 2} color={item.done || item.waiting ? t.color.cobalt : t.color.textSubtle} />
            <Text variant="bodySmall" tone={item.done ? 'primary' : 'muted'} grow numberOfLines={1}>{mine ? item.name : maskObjectionable(item.name)}</Text>
            <LineFacts item={item} />
        </View>
    );
}

/**
 * Today's 3 (or 5): the tasks that mattered most, numbered in order. Each
 * circle fills as the card arrives, one after another; a finished one shows
 * its tick and how long it took, so a friend sees not just that it was done
 * but what it cost.
 */
function TopTasks({ lines, mine }: { lines: DayCardLine[]; mine: boolean }) {
    const t = useTokens();
    const done = lines.filter(line => line.done).length;
    return (
        <View style={styles.top} accessible accessibilityLabel={`Today's ${lines.length}: ${done} of ${lines.length} done. ${lines.map(line =>
            `${mine ? line.name : maskObjectionable(line.name)}, ${line.done ? 'done' : line.waiting ? 'waiting on a friend' : 'not done'}${line.minutes ? `, ${focusDuration(line.minutes * 60)}` : ''}`).join('. ')}`}>
            <Text variant="caption" tone="muted">{`Today's ${lines.length}`}</Text>
            {lines.map((line, index) => (
                <PopIn key={`${line.name}-${index}`} index={index * 2} style={styles.topRow}>
                    <View style={[styles.rank, line.done || line.waiting
                        ? { backgroundColor: t.color.cobalt, borderColor: t.color.cobalt }
                        : { borderColor: t.color.border }]}>
                        {line.done ? <AppIcon name="checkmark" size={Spacing.md} color={textOn(t.color.cobalt)} />
                            : line.waiting ? <AppIcon name="remove" size={Spacing.md} color={textOn(t.color.cobalt)} />
                            : <RNText style={[t.type.caption, { color: t.color.textMuted }]}>{index + 1}</RNText>}
                    </View>
                    <Text variant="bodySmall" tone={line.done ? 'primary' : 'muted'} grow numberOfLines={1}>{mine ? line.name : maskObjectionable(line.name)}</Text>
                    <LineFacts item={line} />
                </PopIn>
            ))}
        </View>
    );
}

/** A day card: the same format whichever of the five day kinds it is (the kind says why it was posted). */
function DayPost({ item, ctx }: { item: StreamPost; ctx: StreamContext }) {
    const { post } = item;
    const card = post.card;
    const done = card.habitsDone + card.tasksDone;
    const total = card.habitsTotal + card.tasksTotal;
    const name = post.mine ? 'You' : post.name;
    const lines = [...(card.habits ?? []), ...(card.tasks ?? [])].sort((a, b) => Number(b.done) - Number(a.done));
    // The rest of the day, under the chevron: what Today's 3 already shows is not listed twice.
    const topNames = new Set((card.top ?? []).map(line => line.name));
    const rest = lines.filter(line => !topNames.has(line.name));
    const did = lines.filter(line => line.done).map(line => (post.mine ? line.name : maskObjectionable(line.name)));
    // The day as a deck of cards: photos first, then what was counted, then the rest (lib/dayDeck.ts).
    const deck = deckCards(card).map(item => (post.mine ? item : { ...item, title: maskObjectionable(item.title) }));

    // One format for every post, so a friend's day always reads the same way: how much of
    // the day was done, out of what, and the bar of it. What made this post (a milestone, a
    // record, a comeback, a long focus) is said in the caption beside the figure.
    let highlight: string | undefined;
    if (item.kind === 'milestone' && card.milestone) {
        const next = STREAK_MILESTONES.find(value => value > card.milestone!) ?? card.milestone * 2;
        highlight = `${card.milestone}-day streak · next ${next}`;
    } else if (item.kind === 'best' && card.best) {
        highlight = card.best.kind === 'streak' ? `Record: ${card.best.days} days in a row` : `Record: ${focusDuration(card.best.minutes * 60)} focused`;
    } else if (item.kind === 'chronos' && card.focusMinutes) {
        highlight = `${focusDuration(card.focusMinutes * 60)} focused`;
    } else if (item.kind === 'comeback' && card.comeback) {
        highlight = `Back after ${card.comeback} days`;
    } else if (total && done === total) {
        highlight = 'All done';
    }
    const hero = <Hero value={`${done}/${total}`} unit="done" caption={highlight} />;
    const visual = <SegmentBar done={done} total={total} />;

    const stats: PostStat[] = [];
    if (card.streak > 0) stats.push({ icon: 'flame', value: String(card.streak), label: 'day streak' });
    if (card.focusMinutes) stats.push({ icon: 'hourglass', value: focusDuration(card.focusMinutes * 60), label: 'focus' });
    if (card.goalsMoved) stats.push({ icon: 'flag', value: String(card.goalsMoved), label: card.goalsMoved === 1 ? 'goal' : 'goals' });

    const avatar = post.mine ? ctx.myAvatar : post.avatarUrl;
    return (
        <PostCard
            lead={<Avatar name={post.mine ? ctx.myName : post.name} uri={avatar} size={Control.hitTarget}
                badge={post.mine ? undefined : (() => { const status = ctx.statusOf(post.userId); return status ? <StatusBadge status={status} size={16} /> : undefined; })()} />}
            name={name} rank={ctx.rankOf(post.userId)}
            when={postedLabel(post.postedAt)}
            hero={hero}
            stats={stats}
            details={rest.length ? <View style={styles.lines}>{rest.map((line, index) => <Line key={`${line.name}-${index}`} item={line} mine={post.mine} />)}</View> : undefined}
            detailsLabel={rest.length ? (card.top?.length ? `${rest.length} more` : `All ${rest.length}`) : undefined}
            onOpenAuthor={() => ctx.openPerson(post.userId)}
            onReport={post.mine ? undefined : () => ctx.onReport(post)}
            footer={<Footer item={item} ctx={ctx} />}>
            {visual}
            {/* The day as a deck: open it, then one card at a time, each with what was planned and what it took. */}
            <DayDeck cards={deck} owner={post.mine ? 'Your' : `${post.name}’s`} />
            {/* The day's most important tasks, when it had them; otherwise a line of what was done. */}
            {card.top?.length ? <TopTasks lines={card.top} mine={post.mine} /> : did.length ? (
                <Text variant="bodySmall" tone="muted" numberOfLines={1}>
                    {`${did.slice(0, 3).join(', ')}${did.length > 3 ? ` +${did.length - 3}` : ''}`}
                </Text>
            ) : null}
        </PostCard>
    );
}

/** A comment as one line on the card: the name, then the words, @mentions in cobalt. */
function Preview({ comment }: { comment: Comment }) {
    const t = useTokens();
    const body = comment.mine ? comment.body : maskObjectionable(comment.body);
    return (
        <RNText numberOfLines={2} style={[t.type.bodySmall, { color: t.color.textPrimary }]}>
            <RNText style={{ fontFamily: t.type.heading.fontFamily }}>{`${comment.authorName}  `}</RNText>
            {splitMentions(body).map((part, index) => (
                <RNText key={index} style={part.mention ? { color: t.color.cobalt } : { color: t.color.textMuted }}>{part.text}</RNText>
            ))}
        </RNText>
    );
}

/**
 * Under a day: the two best comments (most reacted, then most replied), then
 * who reacted, the reactions and the comments button. Any of the comment
 * parts opens the conversation.
 */
function Footer({ item, ctx }: { item: StreamPost; ctx: StreamContext }) {
    const t = useTokens();
    const { post } = item;
    const comments = ctx.commentsOf(item.key);
    const best = bestComments(comments);
    const open = () => ctx.onOpenComments(post);
    return (
        <View style={styles.footer}>
            {best.length ? (
                <Pressable onPress={open} style={styles.previews} accessibilityRole="button"
                    accessibilityLabel={`${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}. Open the conversation`}>
                    {best.map(comment => <Preview key={comment.id} comment={comment} />)}
                    {comments.length > best.length ? <Text variant="caption" tone="muted">{`View all ${comments.length}`}</Text> : null}
                </Pressable>
            ) : null}
            <ReactionBar mine={post.mine} myReaction={post.myReaction} reactions={post.reactions}
                faces={ctx.facesOf(post.ackUsers).map(face => ({ ...face, reaction: post.byUser?.[face.id] }))} onReact={reaction => ctx.onReact(post, reaction)}
                extra={(
                    <Pressable onPress={() => ctx.onOpenComments(post, true)} hitSlop={Spacing.xs} accessibilityRole="button"
                        accessibilityLabel={comments.length ? `${comments.length} comments` : 'Comment'}>
                        <MatteSurface radius={Radius.pill} level="control" style={styles.commentPill}>
                            <AppIcon name="chatbubble" size={Spacing.lg} color={t.color.silver} />
                            {comments.length ? <RNText style={[t.type.caption, styles.numeric, { color: t.color.textPrimary }]}>{comments.length}</RNText> : null}
                        </MatteSurface>
                    </Pressable>
                )} />
        </View>
    );
}

/** A post in Today's feed: a friend's day, drawn as the kind of day it was. */
export function StreamPostCard({ item, ctx }: { item: StreamPost; ctx: StreamContext }) {
    return <DayPost item={item} ctx={ctx} />;
}

const styles = StyleSheet.create({
    footer: { gap: Spacing.md },
    previews: { gap: Spacing.xs },
    commentPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, minWidth: Control.hitTarget - Spacing.xs, minHeight: Control.hitTarget - Spacing.xs, paddingHorizontal: Spacing.md },
    numeric: { fontVariant: ['tabular-nums'] },
    hero: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    lines: { gap: Spacing.xs },
    line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: Spacing.xxl },
    facts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1, maxWidth: '50%' },
    top: { gap: Spacing.xs },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: Spacing.xxl },
    rank: { width: Spacing.xl, height: Spacing.xl, borderRadius: Spacing.xl / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
