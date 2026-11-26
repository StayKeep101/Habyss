import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppIcon, PopIn, SectionTitle, SheetScreen, Text } from '@/components/ui';
import { RankHourglass } from '@/components/Home/RankHourglass';
import { useDayData } from '@/hooks/useDayData';
import { useMarks } from '@/hooks/useMarks';
import { useTokens } from '@/hooks/useTokens';
import { RANKS } from '@/lib/marks';
import { COMING_AWARDS } from '@/lib/comingAwards';
import { Spacing } from '@/theme/designSystem';
import { styles } from '@/styles/screens/awards.styles';

/**
 * Every award: the hourglasses, one a rank (in full once reached, a black
 * shadow until then, with the Marks to go), then the awards on their way,
 * each with what it will take.
 */
export default function AwardsScreen() {
    const t = useTokens();
    const marks = useMarks(useDayData());
    const glass = Spacing.section * 2.8;
    const reached = RANKS.filter(rank => marks.total >= rank.min).length;
    return (
        <SheetScreen title="Awards" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle first right={<Text variant="caption" tone="muted">{`${reached} of ${RANKS.length}`}</Text>}>Hourglasses</SectionTitle>
                <View style={styles.grid}>
                    {RANKS.map((rank, index) => {
                        const earned = marks.total >= rank.min;
                        return (
                            <PopIn key={rank.name} index={index} style={styles.cell}>
                                <View accessible accessibilityLabel={earned ? `${rank.name}, earned` : `${rank.name}, ${(rank.min - marks.total).toLocaleString()} Marks to go`}>
                                    <RankHourglass rank={rank.name} size={glass} look={earned ? 'scene' : 'shadow'} dim={0.3} />
                                </View>
                                <Text variant="caption" tone={earned ? 'primary' : 'muted'} align="center" numberOfLines={1}>{rank.name}</Text>
                                {earned ? null : <Text variant="caption" tone="muted" align="center" numberOfLines={1}>{`${(rank.min - marks.total).toLocaleString()} to go`}</Text>}
                            </PopIn>
                        );
                    })}
                </View>

                <SectionTitle right={<Text variant="caption" tone="muted">Soon</Text>}>Coming soon</SectionTitle>
                <View style={styles.grid}>
                    {COMING_AWARDS.map((award, index) => (
                        <PopIn key={award.id} index={index} style={styles.soon}>
                            <View accessible accessibilityLabel={`${award.name}, coming soon: ${award.what}`} style={styles.soonInner}>
                                <View style={[styles.badge, { backgroundColor: t.color.surfaceRaised }]}>
                                    <AppIcon name={award.icon as never} filled size={Spacing.xxl} color={t.color.textSubtle} />
                                </View>
                                <Text variant="caption" align="center" numberOfLines={1}>{award.name}</Text>
                                <Text variant="caption" tone="muted" align="center" numberOfLines={2}>{award.what}</Text>
                            </View>
                        </PopIn>
                    ))}
                </View>
            </ScrollView>
        </SheetScreen>
    );
}
