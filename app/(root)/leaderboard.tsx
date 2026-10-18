import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Avatar } from '@/components/ui/Avatar';
import { AnimatedFill, CountUp, ListItem } from '@/components/ui/Motion';
import { IconTile } from '@/components/ui/IconTile';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { FeedService, type LeaderRow } from '@/lib/feedService';
import { localMarks } from '@/lib/marksSync';
import { rankBand } from '@/lib/marks';
import { useMyProfile } from '@/hooks/useMyProfile';
import { styles } from '@/styles/screens/leaderboard.styles';

type Scope = 'friends' | 'league';

/**
 * Where you stand, by Marks: among your friends, or in your league — everyone
 * on Habyss in the same rank as you, so the race is always a fair one. Your
 * row is lit; tap anyone for their page.
 */
export default function LeaderboardScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    // `?scope=league` opens straight on your league (from the rank-up moment).
    const params = useLocalSearchParams<{ scope?: string }>();
    const [scope, setScope] = useState<Scope>(params.scope === 'league' ? 'league' : 'friends');
    const [rows, setRows] = useState<LeaderRow[] | null>(null);
    // Your rank band, from your own Marks: the league is everyone in it.
    const [band, setBand] = useState<ReturnType<typeof rankBand> | null>(null);
    const [myMarks, setMyMarks] = useState(0);
    useEffect(() => { void localMarks().then(total => { setMyMarks(total ?? 0); setBand(rankBand(total ?? 0)); }); }, []);
    // Lost is the qualifying stage: no league until the first rank is reached.
    const unranked = band?.min === 0;
    const myProfile = useMyProfile();

    useEffect(() => {
        if (scope === 'league' && (!band || unranked)) { setRows([]); return; }
        let alive = true;
        setRows(null);
        void FeedService.leaderboard(scope, scope === 'league' && band ? band : undefined).then(list => { if (alive) setRows(list); });
        return () => { alive = false; };
    }, [scope, band, unranked]);

    const mine = rows?.find(row => row.isMe);
    const total = rows?.length ?? 0;

    return (
        <SheetScreen title="Leaderboard" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <ChoiceRow<Scope> options={[{ id: 'friends', label: 'Friends' }, { id: 'league', label: !band ? 'League' : unranked ? 'Unranked' : `${band.name} league` }]}
                    value={scope} onChange={setScope} accessibilityLabel="Leaderboard scope" />

                {scope === 'league' && unranked && band ? (
                    // Not in a league yet: what it takes to get into one.
                    <VoidCard style={styles.unranked}>
                        <IconTile icon="lock-closed" color={primary} size={48} shape="square" />
                        <Text style={[styles.unrankedTitle, { color: colors.textPrimary }]}>Unranked</Text>
                        <Text style={[styles.unrankedText, { color: colors.textSecondary }]}>
                            Reach Beginner to join your first league. {Math.max(0, (band.max ?? 0) - myMarks).toLocaleString()} Marks to go.
                        </Text>
                        <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
                            <AnimatedFill progress={band.max ? myMarks / band.max : 0} style={[styles.fill, { backgroundColor: primary }]} />
                        </View>
                        <Text style={[styles.unrankedMeta, { color: colors.textTertiary }]}>{myMarks.toLocaleString()} / {(band.max ?? 0).toLocaleString()} Marks</Text>
                    </VoidCard>
                ) : null}

                {scope === 'league' && unranked ? null : <View style={styles.hero}>
                    <CountUp style={[styles.heroRank, { color: colors.textPrimary }]} value={mine ? `#${mine.rank}` : '—'} replay={scope} />
                    <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                        {scope === 'league' && band
                            ? `${band.name} league · ${band.max ? `${band.min.toLocaleString()}–${(band.max - 1).toLocaleString()}` : `${band.min.toLocaleString()}+`} Marks`
                            : mine ? `${mine.marks.toLocaleString()} Marks` : 'Earn Marks to get on the board'}
                    </Text>
                </View>}

                {scope === 'league' && unranked ? null : rows === null ? <ActivityIndicator color={colors.textTertiary} /> : total === 0 ? (
                    <Text style={[styles.empty, { color: colors.textTertiary }]}>Nobody here yet</Text>
                ) : (
                    <VoidCard style={styles.list}>
                        {rows.map((row, index) => {
                            // A gap before your own row when you are outside the top 50.
                            const gap = index > 0 && row.rank - rows[index - 1].rank > 1;
                            return (
                                <ListItem key={row.userId} index={index}>
                                    <Pressable
                                        // Anyone on the board opens their page; for someone who is
                                        // not a friend yet, that page offers to add them.
                                        onPress={() => {
                                            lightFeedback();
                                            if (row.isMe) router.push('/(root)/profile');
                                            else router.push({ pathname: '/(root)/friend' as never, params: { id: row.userId } });
                                        }}
                                        accessibilityRole="button"
                                        style={[styles.row, (index > 0) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, gap && styles.gap]}
                                        accessibilityLabel={`Number ${row.rank}, ${row.isMe ? 'you' : row.name}, ${row.marks} Marks`}>
                                        <Text style={[styles.place, { color: row.rank <= 3 ? primary : colors.textTertiary }]}>{row.rank}</Text>
                                        <Avatar name={row.name} uri={row.isMe ? myProfile.avatar : row.avatarUrl} size={36} ring={row.isMe ? primary : undefined} />
                                        <Text numberOfLines={1} style={[styles.name, { color: row.isMe ? primary : colors.textPrimary }]}>
                                            {row.isMe ? 'You' : row.name}
                                        </Text>
                                        <Text style={[styles.marks, { color: colors.textPrimary }]}>{row.marks.toLocaleString()}</Text>
                                    </Pressable>
                                </ListItem>
                            );
                        })}
                    </VoidCard>
                )}
            </ScrollView>
        </SheetScreen>
    );
}
