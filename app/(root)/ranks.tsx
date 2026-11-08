import React from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RankGem, SheetScreen, Text } from '@/components/ui';
import { AnimatedFill, CountUp, PopIn } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { RANKS, rankFor } from '@/lib/marks';
import { rankTone } from '@/theme/tokens';
import { styles } from '@/styles/screens/ranks.styles';

/**
 * The ranks as a collection of gems, one cut in ten colours, darker at the
 * bottom of the climb and brighter towards the light. Yours is large on top
 * with how far to the next; below, every rank: the ones reached lit, the ones
 * ahead still dark stone, each with the Marks it takes.
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
                    <RankGem rank={rank.name} size={t.space['3xl'] * 4} />
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

                <View style={styles.grid}>
                    {RANKS.map((item, index) => {
                        const reached = marks >= item.min;
                        const current = item.name === rank.name;
                        return (
                            <PopIn key={item.name} index={index} style={styles.cell}>
                                <RankGem rank={item.name} size={t.space['3xl'] * 2} locked={!reached} shine={current} />
                                <Text variant={current ? 'heading' : 'bodySmall'} tone={reached ? undefined : 'muted'} align="center">{item.name}</Text>
                                <Text variant="caption" tone="muted" align="center">{item.min === 0 ? 'Start' : item.min.toLocaleString()}</Text>
                            </PopIn>
                        );
                    })}
                </View>
            </ScrollView>
        </SheetScreen>
    );
}
