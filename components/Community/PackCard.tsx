import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Avatar } from '@/components/ui/Avatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily } from '@/theme/designSystem';
import { cardShare, type DayCardLine } from '@/lib/dayCard';
import { maskObjectionable } from '@/lib/contentFilter';
import { isPerfect } from '@/lib/dailyPack';
import type { FeedPost } from '@/lib/feedService';

/** Foil for a perfect day: the rare card. */
export const FOIL = ['#F7D774', '#F2A65A', '#E86FB0', '#8E8CF0', '#6FD3E8', '#F7D774'] as const;

/**
 * One friend's day as a trading card: their face and name, how much of the
 * day they did as one large figure, their streak, and the things they did.
 * A perfect day has a foil edge, the rare card of the pack.
 */
export function PackCard({ post, width, height }: { post: FeedPost; width: number; height: number }) {
    const t = useTokens();
    const share = cardShare(post.card);
    const perfect = isPerfect(post);
    const done = post.card.habitsDone + post.card.tasksDone;
    const total = post.card.habitsTotal + post.card.tasksTotal;
    const lines: DayCardLine[] = [...(post.card.habits ?? []), ...(post.card.tasks ?? [])].filter(line => line.done);
    const shown = lines.slice(0, 4);
    const radius = 28;
    const face = (
        <MatteSurface radius={perfect ? radius - 3 : radius} elevation="floating" style={[styles.face, { padding: width * 0.07 }]}>
            <View style={styles.top}>
                <Avatar name={post.name} uri={post.avatarUrl} size={44} />
                <View style={styles.who}>
                    <Text numberOfLines={1} style={[styles.name, { color: t.color.textPrimary }]}>{post.name}</Text>
                    {post.username ? <Text numberOfLines={1} style={[styles.handle, { color: t.color.textMuted }]}>{`@${post.username}`}</Text> : null}
                </View>
                {post.card.streak > 0 ? (
                    <View style={styles.streak} accessibilityLabel={`${post.card.streak} days in a row`}>
                        <AppIcon name="flame" filled size={15} color={t.color.warning} />
                        <Text style={[styles.streakText, { color: t.color.textPrimary }]}>{post.card.streak}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.middle}>
                <Text style={[styles.percent, { color: t.color.textPrimary, fontSize: width * 0.26 }]}>{`${Math.round(share * 100)}%`}</Text>
                <Text style={[styles.of, { color: perfect ? t.color.textPrimary : t.color.textMuted }]}>
                    {perfect ? 'Perfect day' : total ? `${done} of ${total} done` : 'A rest day'}
                </Text>
            </View>

            <View style={styles.lines}>
                {shown.map((line, index) => (
                    <View key={`${line.name}:${index}`} style={styles.line}>
                        <AppIcon name="checkmark-circle" filled size={16} color={t.color.success} />
                        <Text numberOfLines={1} style={[styles.lineText, { color: t.color.textPrimary }]}>{maskObjectionable(line.name)}</Text>
                    </View>
                ))}
                {lines.length > shown.length ? <Text style={[styles.more, { color: t.color.textMuted }]}>{`+${lines.length - shown.length} more`}</Text> : null}
            </View>
        </MatteSurface>
    );
    return (
        <View style={{ width, height }} accessible accessibilityLabel={`${post.name}: ${perfect ? 'a perfect day' : `${done} of ${total} done`}, ${post.card.streak} days in a row.`}>
            {perfect ? (
                <LinearGradient colors={FOIL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.foil, { borderRadius: radius }]}>
                    {face}
                </LinearGradient>
            ) : face}
        </View>
    );
}

/** The back of every card: the accent, deep and quiet, with Habyss's mark. */
export function PackBack({ width, height, colors }: { width: number; height: number; colors: readonly [string, string] }) {
    return (
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.back, { width, height }]}>
            <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.25)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.backInset}>
                <Image source={require('@/assets/images/habyss-mark.png')} style={{ width: width * 0.32, height: width * 0.32, tintColor: 'rgba(255,255,255,0.9)' }} resizeMode="contain" />
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    foil: { flex: 1, padding: 3 },
    face: { flex: 1, justifyContent: 'space-between' },
    top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    who: { flex: 1 },
    name: { fontSize: 17, fontFamily: FontFamily.bold },
    handle: { fontSize: 13, fontFamily: FontFamily.medium },
    streak: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    streakText: { fontSize: 15, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    middle: { alignItems: 'center' },
    percent: { fontFamily: FontFamily.bold, letterSpacing: -3, fontVariant: ['tabular-nums'] },
    of: { fontSize: 15, fontFamily: FontFamily.semibold, marginTop: -4 },
    lines: { gap: 8, minHeight: 112, justifyContent: 'flex-end' },
    line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    lineText: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium },
    more: { fontSize: 13, fontFamily: FontFamily.medium, marginLeft: 24 },
    back: { borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    backInset: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
});
