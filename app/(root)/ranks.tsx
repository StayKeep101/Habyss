import React from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppIcon, MatteSurface, SheetScreen, Text } from '@/components/ui';
import { RankHourglass } from '@/components/Home/RankHourglass';
import { LinearGradient } from 'expo-linear-gradient';
import { useSharedValue } from 'react-native-reanimated';
import { Hourglass } from '@/components/Home/Hourglass';
import { glassDesign } from '@/theme/hourglassDesigns';
import { rankGradient } from '@/theme/rankLooks';
import { AnimatedFill, CountUp, PopIn } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { RANKS, rankFor } from '@/lib/marks';
import { rankTone } from '@/theme/tokens';
import { styles } from '@/styles/screens/ranks.styles';

/** One rank: its name, and what it unlocks; locked ones dimmed but still showing what is ahead. */
function RankRow({ name, min, marks, current }: { name: string; min: number; marks: number; current: boolean }) {
    const t = useTokens();
    const reached = marks >= min;
    const [from, to] = rankGradient(name);
    const sand = useSharedValue(0.35);
    return (
        <View accessible accessibilityLabel={`${name}, ${min ? `${min.toLocaleString()} Marks` : 'the start'}. ${current ? 'Your rank.' : reached ? 'Reached.' : `Locked, ${(min - marks).toLocaleString()} Marks to go.`} Unlocks its colour and its hourglass.`}>
        <MatteSurface radius={t.radius.lg} edge={current ? rankTone(name).color : undefined} style={styles.row}>
            <View style={[styles.rowMain, !reached && styles.locked]}>
                <View style={styles.rowText}>
                    <Text variant="heading">{name}</Text>
                    <View style={styles.status}>
                        {!reached ? <AppIcon name="lock-closed" size={t.space.md} color={t.color.textMuted} /> : null}
                        <Text variant="caption" tone="muted">
                            {current ? 'You are here' : reached ? 'Reached' : `${(min - marks).toLocaleString()} Marks to go`}
                        </Text>
                    </View>
                    {/* The app's colour at this rank. */}
                    <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.swatch} />
                </View>
                <Hourglass design={glassDesign(name)} size={t.space['3xl'] * 2} ran={sand} running={false} />
            </View>
        </MatteSurface>
        </View>
    );
}

/**
 * The ranks, and what climbing them gives you. Yours on top, large, with how
 * far to the next. Below, the climb: every rank as a row with its name, the
 * Marks it takes, and what it unlocks, the app's colour at that rank
 * (theme/rankLooks.ts) and its hourglass (theme/hourglassDesigns.ts). Ranks
 * ahead are dimmed and locked but still show what is waiting.
 */
export default function RanksScreen() {
    const t = useTokens();
    const params = useLocalSearchParams<{ marks?: string }>();
    const marks = Math.max(0, Number(params.marks) || 0);
    const { rank, next, progress, toNext } = rankFor(marks);

    return (
        <SheetScreen title="Ranks" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <RankHourglass rank={rank.name} size={t.space['3xl'] * 4} />
                    <Text variant="screenTitle" align="center" accessibilityRole="header">{rank.name}</Text>
                    <Text variant="body" tone="muted" align="center">
                        <CountUp value={marks} /> Marks
                    </Text>
                    <View style={[styles.track, { backgroundColor: t.color.surfaceRaised }]}>
                        <AnimatedFill progress={progress} style={[styles.fill, { backgroundColor: rankTone(rank.name).color }]} />
                    </View>
                    <Text variant="caption" tone="muted" align="center">
                        {next ? `${toNext.toLocaleString()} Marks to ${next.name}` : 'Out of the abyss'}
                    </Text>
                </View>

                {/* The climb: every rank and what it gives you, the app's colour and its hourglass. */}
                <View style={styles.climb}>
                    <Text variant="title" accessibilityRole="header">The climb</Text>
                    <Text variant="bodySmall" tone="muted">Each rank dresses the app in its colour and gives you its hourglass.</Text>
                    {RANKS.map((item, index) => (
                        <PopIn key={item.name} index={index}>
                            <RankRow name={item.name} min={item.min} marks={marks} current={item.name === rank.name} />
                        </PopIn>
                    ))}
                </View>
            </ScrollView>
        </SheetScreen>
    );
}
