import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { EmptyState, IconButton, SheetScreen } from '@/components/ui';
import { StreamPostCard, type StreamContext } from '@/components/Community/StreamPostCard';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useWeekStart } from '@/hooks/useWeekStart';
import { FeedService, type FeedPost } from '@/lib/feedService';
import { buildStream } from '@/lib/communityStream';
import { localDateKey } from '@/lib/habitSchedule';
import { Spacing } from '@/theme/designSystem';
import { styles } from '@/styles/screens/journal.styles';

const MONDAY_FIRST = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SUNDAY_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PAGE = 50;

/**
 * Your journal: every day you posted, on a calendar. A day with a card has a
 * ring of how much of it was done (a dot under it when you wrote a note);
 * tap it for that day's pack of cards, as friends saw it. The arrows go month
 * to month. The cards are read from your posts as you go back (fifty at a
 * time), never kept on the phone.
 */
export default function JournalScreen() {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const profile = useMyProfile();
    const mondayFirst = useWeekStart() === 'monday';
    const [me, setMe] = useState<string | null>(null);
    const [cards, setCards] = useState<Map<string, FeedPost>>(new Map());
    const [oldest, setOldest] = useState<{ day: string; before?: string; done: boolean }>({ day: '9999-12-31', done: false });
    const [offset, setOffset] = useState(0);
    const today = localDateKey(new Date());
    const [chosen, setPicked] = useState<string | null>(null);

    const month = useMemo(() => { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() + offset); return date; }, [offset]);
    const monthStart = localDateKey(month);

    useEffect(() => { void FeedService.me().then(setMe); }, []);
    // Reads your posts back until this month is covered (or there are no more).
    const loadTo = useCallback(async (floor: string) => {
        if (!me || oldest.done || oldest.day <= floor) return;
        let before = oldest.before;
        let day = oldest.day;
        let done = false;
        const found = new Map(cards);
        while (day > floor) {
            const page = await FeedService.feed(before, PAGE, me).catch(() => []);
            for (const post of page) found.set(post.day, post);
            if (page.length < PAGE) { done = true; break; }
            before = page[page.length - 1].postedAt;
            day = page[page.length - 1].day;
        }
        setCards(found);
        setOldest({ day, before, done });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [me, oldest]);
    useEffect(() => {
        const timer = setTimeout(() => void loadTo(monthStart), 0);
        return () => clearTimeout(timer);
    }, [me, monthStart]); // eslint-disable-line react-hooks/exhaustive-deps

    const firstWeekday = (month.getDay() + (mondayFirst ? 6 : 0)) % 7;
    const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const keys = Array.from({ length: daysIn }, (_, index) => localDateKey(new Date(month.getFullYear(), month.getMonth(), index + 1, 12)));
    const ring = Spacing.section + Spacing.sm;
    const stroke = 3.5;
    const radius = (ring - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    // The day shown: the one tapped, else your latest posted day this month.
    const latest = keys.filter(key => cards.has(key)).pop() ?? today;
    const picked = chosen && chosen.slice(0, 7) === monthStart.slice(0, 7) ? chosen : latest;
    const shown = cards.get(picked);
    // Still reading back to this month.
    const loading = !me || (!oldest.done && oldest.day > monthStart);

    const ctx: StreamContext = {
        meId: me, myName: profile.name || 'You', myAvatar: profile.avatar ?? undefined,
        rankOf: () => null, statusOf: () => undefined, facesOf: () => [],
        onReact: () => undefined, onReport: () => undefined, openPerson: () => undefined,
        commentsOf: () => [], onOpenComments: () => undefined,
    };

    return (
        <SheetScreen title="Journal" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.monthRow}>
                    <RNText style={[styles.month, { color: t.color.textPrimary }]} accessibilityRole="header">
                        {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </RNText>
                    <View style={styles.arrows}>
                        <IconButton icon="chevron-back" label="Previous month" diameter={36} size={18} onPress={() => { selectionFeedback(); setOffset(value => value - 1); }} />
                        <IconButton icon="chevron-forward" label="Next month" diameter={36} size={18} disabled={offset >= 0} onPress={() => { selectionFeedback(); setOffset(value => Math.min(0, value + 1)); }} />
                    </View>
                </View>

                <View style={styles.grid}>
                    {(mondayFirst ? MONDAY_FIRST : SUNDAY_FIRST).map((label, index) => (
                        <RNText key={index} style={[styles.weekday, { color: t.color.textSubtle }]}>{label}</RNText>
                    ))}
                    {Array.from({ length: firstWeekday }, (_, index) => <View key={`b${index}`} style={styles.cell} />)}
                    {keys.map(key => {
                        const post = cards.get(key);
                        const card = post?.card;
                        const total = card ? card.habitsTotal + card.tasksTotal : 0;
                        const fill = card && total ? Math.min(1, (card.habitsDone + card.tasksDone) / total) : 0;
                        const isPicked = key === picked;
                        const future = key > today;
                        return (
                            <View key={key} style={styles.cell}>
                                <Pressable disabled={!post} onPress={() => { selectionFeedback(); setPicked(key); }} accessibilityRole="button"
                                    accessibilityState={{ selected: isPicked, disabled: !post }}
                                    accessibilityLabel={`${new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${card ? `, ${card.habitsDone + card.tasksDone} of ${total} done${card.note ? ', with a note' : ''}` : ', nothing posted'}`}
                                    style={[styles.day, { width: ring, height: ring, opacity: future ? 0.3 : post ? 1 : 0.45 }]}>
                                    <Svg width={ring} height={ring} style={styles.ring}>
                                        <Circle cx={ring / 2} cy={ring / 2} r={radius} stroke={t.color.accent} strokeOpacity={isPicked ? 0.4 : 0.14} strokeWidth={stroke} fill={isPicked ? t.tint('subtle') : 'none'} />
                                        {fill > 0 ? (
                                            <Circle cx={ring / 2} cy={ring / 2} r={radius} stroke={t.color.accent} strokeWidth={stroke} fill="none"
                                                strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - fill)}
                                                strokeLinecap="round" rotation={-90} origin={`${ring / 2}, ${ring / 2}`} />
                                        ) : null}
                                    </Svg>
                                    <RNText style={[styles.dayNumber, { color: isPicked || key === today ? t.color.accentText : t.color.textMuted }]}>{Number(key.slice(-2))}</RNText>
                                    {card?.note ? <View style={[styles.noteDot, { backgroundColor: t.color.accent }]} /> : null}
                                </Pressable>
                            </View>
                        );
                    })}
                </View>

                {/* The day picked, as its pack of cards. */}
                {shown ? (
                    <StreamPostCard key={shown.day} item={buildStream([shown])[0]} ctx={ctx} footer={false} />
                ) : (
                    <EmptyState icon="book" title={loading ? 'Reading your days…' : 'Nothing posted that day'}
                        message={loading ? '' : 'Your day card goes up at your post time; it lands here with your note.'} />
                )}
            </ScrollView>
        </SheetScreen>
    );
}
