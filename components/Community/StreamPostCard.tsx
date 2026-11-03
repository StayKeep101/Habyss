import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
    AppButton, AppIcon, Avatar, CountUp, Crown, FaceStack, IconTile, PostCard, SegmentBar, Text, VersusBar, type PostStat,
} from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { Control, Spacing } from '@/theme/designSystem';
import { maskObjectionable } from '@/lib/contentFilter';
import { focusDuration } from '@/lib/focusStats';
import { daysLeft, leader, shareOf } from '@/lib/duels';
import { revealText } from '@/lib/weekly';
import { STREAK_MILESTONES } from '@/lib/dayMoments';
import type { StreamPost } from '@/lib/communityStream';
import type { DayCardLine } from '@/lib/dayCard';
import type { FeedPost } from '@/lib/feedService';
import type { FriendStatus } from '@/lib/presence';
import type { Reaction } from '@/lib/reactions';
import { StatusBadge } from './StatusBadge';
import { ReactionBar } from './ReactionBar';

/** What a post needs from the page around it. */
export interface StreamContext {
    meId: string | null;
    myName: string;
    myAvatar?: string;
    kingId: string | null;
    rankOf: (userId: string) => number | null;
    statusOf: (userId: string) => FriendStatus | undefined;
    facesOf: (userIds: string[]) => { name: string; avatarUrl?: string }[];
    onReact: (post: FeedPost, reaction: Reaction | null) => void;
    onReport: (post: FeedPost) => void;
    openPerson: (userId: string) => void;
    /** Starts a duel (the + sheet), for a rematch. */
    rematch: () => void;
    /** Shows This week, for the race behind the crown. */
    seeWeek: () => void;
}

const KIND = {
    daily: { icon: 'today', label: 'Today' },
    milestone: { icon: 'flag', label: 'Milestone' },
    best: { icon: 'trophy', label: 'Personal best' },
    chronos: { icon: 'hourglass', label: 'Chronos' },
    comeback: { icon: 'trending-up', label: 'Comeback' },
    rivalry: { icon: 'flash', label: 'Rivalry' },
    victory: { icon: 'trophy', label: 'Victory' },
    squad: { icon: 'people', label: 'Squad' },
    king: { icon: 'ribbon', label: 'King of the Week' },
    mission: { icon: 'eye-off', label: 'Secret mission' },
} as const;

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

/** One thing from the day, ticked or not. */
function Line({ item, mine }: { item: DayCardLine; mine: boolean }) {
    const t = useTokens();
    return (
        <View style={styles.line}>
            <AppIcon name={item.done ? 'checkmark-circle' : item.skipped ? 'remove-circle' : 'ellipse-outline'} filled={item.done}
                size={Spacing.lg + 2} color={item.done ? t.color.cobalt : t.color.textSubtle} />
            <Text variant="bodySmall" tone={item.done ? 'primary' : 'muted'} grow numberOfLines={1}>{mine ? item.name : maskObjectionable(item.name)}</Text>
            {item.skipped ? <Text variant="caption" tone="muted">Skipped</Text> : null}
        </View>
    );
}

/** A day card, as whichever of the five day kinds it is. */
function DayPost({ item, ctx }: { item: Extract<StreamPost, { post: FeedPost }>; ctx: StreamContext }) {
    const t = useTokens();
    const { post } = item;
    const card = post.card;
    const done = card.habitsDone + card.tasksDone;
    const total = card.habitsTotal + card.tasksTotal;
    const name = post.mine ? 'You' : post.name;
    const lines = [...(card.habits ?? []), ...(card.tasks ?? [])].sort((a, b) => Number(b.done) - Number(a.done));
    const did = lines.filter(line => line.done).map(line => (post.mine ? line.name : maskObjectionable(line.name)));

    let hero: React.ReactNode;
    let visual: React.ReactNode = <SegmentBar done={done} total={total} />;
    if (item.kind === 'milestone' && card.milestone) {
        const next = STREAK_MILESTONES.find(value => value > card.milestone!) ?? card.milestone * 2;
        hero = <Hero value={String(card.milestone)} unit="day streak" caption={`Next: ${next}`} />;
        visual = <SegmentBar done={card.milestone} total={next} accessibilityLabel={`${card.milestone} of ${next} days to the next milestone`} />;
    } else if (item.kind === 'best' && card.best) {
        hero = card.best.kind === 'streak'
            ? <Hero value={String(card.best.days)} unit="days in a row" caption="New record" />
            : <Hero value={focusDuration(card.best.minutes * 60)} unit="focused" caption="New record" />;
    } else if (item.kind === 'chronos' && card.focusMinutes) {
        // Half-hour blocks of focus, up to a four-hour day.
        hero = <Hero value={focusDuration(card.focusMinutes * 60)} unit="focused" />;
        visual = <SegmentBar done={Math.round(card.focusMinutes / 30)} total={Math.max(8, Math.round(card.focusMinutes / 30))}
            accessibilityLabel={`${focusDuration(card.focusMinutes * 60)} of focus`} />;
    } else if (item.kind === 'comeback' && card.comeback) {
        hero = <Hero value="Back" unit={`after ${card.comeback} days`} />;
        // The days away, quiet, then today, lit.
        visual = (
            <View style={styles.away} accessible accessibilityLabel={`${card.comeback} days away, then back today`}>
                {Array.from({ length: Math.min(card.comeback, 14) }, (_, index) => (
                    <View key={index} style={[styles.awayDay, { backgroundColor: t.color.surfaceRaised }]} />
                ))}
                <View style={[styles.awayDay, styles.today, { backgroundColor: t.color.cobalt }]} />
            </View>
        );
    } else {
        hero = <Hero value={total ? `${Math.round((done / total) * 100)}%` : '0%'} caption={total ? `${done} of ${total} done` : undefined} />;
    }

    const stats: PostStat[] = [];
    if (card.streak > 0) stats.push({ icon: 'flame', value: String(card.streak), label: card.streak === 1 ? 'day' : 'days' });
    if (card.focusMinutes && item.kind !== 'chronos') stats.push({ icon: 'hourglass', value: focusDuration(card.focusMinutes * 60), label: 'focus' });
    if (card.goalsMoved) stats.push({ icon: 'flag', value: String(card.goalsMoved), label: card.goalsMoved === 1 ? 'goal' : 'goals' });

    const avatar = post.mine ? ctx.myAvatar : post.avatarUrl;
    return (
        <PostCard
            lead={<Avatar name={post.mine ? ctx.myName : post.name} uri={avatar} size={Control.hitTarget}
                badge={post.mine ? undefined : (() => { const status = ctx.statusOf(post.userId); return status ? <StatusBadge status={status} size={16} /> : undefined; })()} />}
            name={name} badge={post.userId === ctx.kingId ? <Crown size={Spacing.lg} /> : undefined} rank={ctx.rankOf(post.userId)}
            kind={KIND[item.kind]} when={postedLabel(post.postedAt)}
            hero={hero}
            stats={stats}
            details={lines.length ? <View style={styles.lines}>{lines.map((line, index) => <Line key={`${line.name}-${index}`} item={line} mine={post.mine} />)}</View> : undefined}
            onOpenAuthor={() => ctx.openPerson(post.userId)}
            onReport={post.mine ? undefined : () => ctx.onReport(post)}
            footer={<ReactionBar mine={post.mine} myReaction={post.myReaction} reactions={post.reactions}
                faces={ctx.facesOf(post.ackUsers)} onReact={reaction => ctx.onReact(post, reaction)} />}>
            {visual}
            {did.length ? (
                <Text variant="bodySmall" tone="muted" numberOfLines={1}>
                    {`${did.slice(0, 3).join(', ')}${did.length > 3 ? ` +${did.length - 3}` : ''}`}
                </Text>
            ) : null}
        </PostCard>
    );
}

/** Any post in the stream, drawn for its kind. */
export function StreamPostCard({ item, ctx }: { item: StreamPost; ctx: StreamContext }) {
    const t = useTokens();
    if ('post' in item) return <DayPost item={item} ctx={ctx} />;

    if (item.kind === 'rivalry') {
        const { duel } = item;
        const ahead = leader(duel);
        const left = daysLeft(duel.ends);
        return (
            <PostCard live kind={KIND.rivalry} when={`${left} ${left === 1 ? 'day' : 'days'} left`}
                lead={<Avatar name={duel.name} uri={duel.avatarUrl} size={Control.hitTarget} />}
                name={`You vs ${duel.name.split(' ')[0]}`} onOpenAuthor={() => ctx.openPerson(duel.friendId)}
                hero={<Hero value={ahead === 'me' ? 'Ahead' : ahead === 'them' ? 'Behind' : 'Even'} caption={duel.stake ? `${duel.stake * 2} Shards on it` : 'For pride'} />}>
                <VersusBar left={{ label: 'You', percent: shareOf(duel.me) * 100, color: t.color.cobalt }}
                    right={{ label: duel.name.split(' ')[0], percent: shareOf(duel.them) * 100, color: t.color.silver }} />
            </PostCard>
        );
    }

    if (item.kind === 'victory' && item.duel) {
        const { duel } = item;
        const won = duel.winnerId === null ? null : duel.winnerId !== duel.friendId;
        return (
            <PostCard kind={KIND.victory} when={`${duel.days}-day duel`}
                lead={<IconTile icon={won ? 'trophy' : 'flag'} color={won ? t.color.cobalt : t.color.silver} size={Control.hitTarget} />}
                name={won === null ? `Draw with ${duel.name}` : won ? `You beat ${duel.name}` : `${duel.name} beat you`}
                hero={duel.stake && won !== null ? <Hero value={won ? `+${duel.stake * 2}` : `−${duel.stake}`} unit="Shards" /> : undefined}
                footer={<AppButton label={won ? 'Run it back' : 'Rematch'} icon="flash" variant="ghost" onPress={ctx.rematch} />}>
                <VersusBar left={{ label: 'You', percent: shareOf(duel.me) * 100, color: t.color.cobalt }}
                    right={{ label: duel.name.split(' ')[0], percent: shareOf(duel.them) * 100, color: t.color.silver }} />
            </PostCard>
        );
    }

    if (item.kind === 'victory' && item.market) {
        const { market } = item;
        const total = market.pool.make + market.pool.miss;
        const made = market.status === 'won';
        const owner = market.mine ? 'You' : market.name.split(' ')[0];
        return (
            <PostCard kind={KIND.victory} when={market.title}
                lead={<Avatar name={market.name} uri={market.avatarUrl} size={Control.hitTarget} />}
                name={`${owner} ${made ? 'made it' : 'missed it'}`} onOpenAuthor={() => ctx.openPerson(market.ownerId)}
                hero={<Hero value={String(total)} unit="Shards in play" caption={made ? 'Backers win' : 'Doubters win'} />}>
                <VersusBar left={{ label: 'Backed', percent: total ? (market.pool.make / total) * 100 : 50, color: made ? t.color.cobalt : t.color.silver }}
                    right={{ label: 'Doubted', percent: total ? (market.pool.miss / total) * 100 : 50, color: made ? t.color.silver : t.color.cobalt }} />
            </PostCard>
        );
    }

    if (item.kind === 'squad') {
        return (
            <PostCard kind={KIND.squad} when="This week"
                lead={<IconTile icon="people" color={t.color.cobalt} size={Control.hitTarget} />}
                name="The crew did it"
                hero={<Hero value={String(item.done)} unit="show-ups together" caption={`Goal ${item.target}`} />}>
                <SegmentBar done={item.done} total={item.target} />
                <FaceStack faces={item.crew.map(member => ({ userId: member.userId, name: member.name, avatarUrl: member.avatarUrl }))} size={Spacing.xxl + Spacing.xs} shown={6} />
            </PostCard>
        );
    }

    if (item.kind === 'king') {
        const { king } = item;
        const you = king.userId === ctx.meId;
        return (
            <PostCard kind={KIND.king} when="This week"
                lead={<Avatar name={king.name} uri={king.avatarUrl} size={Control.hitTarget} ring={t.color.cobalt} badge={<Crown size={Spacing.lg} />} />}
                name={you ? 'You wear the crown' : `${king.name} wears the crown`} onOpenAuthor={() => ctx.openPerson(king.userId)}
                hero={<Hero value={String(king.days)} unit="of 7 days" caption="Most consistent" />}
                footer={<AppButton label="See the race" icon="podium" variant="ghost" onPress={ctx.seeWeek} />}>
                <SegmentBar done={king.days} total={7} accessibilityLabel={`${king.days} of 7 days`} />
            </PostCard>
        );
    }

    // A secret mission, revealed.
    const { revealed } = item;
    return (
        <PostCard kind={KIND.mission} when="Revealed"
            lead={<Avatar name={revealed.mine ? revealed.friendName : revealed.ownerName} uri={revealed.mine ? undefined : revealed.ownerAvatar} size={Control.hitTarget}
                badge={<AppIcon name="eye-off" filled size={Spacing.md} color={t.color.textPrimary} />} />}
            name={revealed.mine ? 'Your secret is out' : `${revealed.ownerName} had a secret`}>
            <Text variant="body">{revealText(revealed)}</Text>
        </PostCard>
    );
}

const styles = StyleSheet.create({
    hero: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    lines: { gap: Spacing.xs },
    line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: Spacing.xxl },
    away: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, height: Spacing.sm },
    awayDay: { flex: 1, height: Spacing.xs, borderRadius: Spacing.xs },
    today: { height: Spacing.sm, flex: 2 },
});
