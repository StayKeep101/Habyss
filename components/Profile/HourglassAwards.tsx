import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon, PopIn, SectionTitle, Text } from '@/components/ui';
import { RankHourglass } from '@/components/Home/RankHourglass';
import { useTokens } from '@/hooks/useTokens';
import { RANKS } from '@/lib/marks';
import { Spacing } from '@/theme/designSystem';

const GLASS = Spacing.section * 2.6;

/**
 * Awards: the hourglasses, one for every rank. Those reached stand lit with
 * their name; the rest wait dimmed, with how many Marks are still to go. The
 * newest one earned comes first, then the next to earn.
 */
export function HourglassAwards({ marks }: { marks: number }) {
    const t = useTokens();
    const reached = RANKS.filter(rank => marks >= rank.min).length;
    return (
        <View style={styles.wrap}>
            <SectionTitle first right={<Text variant="caption" tone="muted">{`${reached} of ${RANKS.length}`}</Text>}>Awards</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {RANKS.map((rank, index) => {
                    const earned = marks >= rank.min;
                    return (
                        <PopIn key={rank.name} index={index} style={styles.award}>
                            <View accessible accessibilityLabel={earned ? `${rank.name}, earned` : `${rank.name}, ${(rank.min - marks).toLocaleString()} Marks to go`}
                                style={{ opacity: earned ? 1 : 0.4 }}>
                                <RankHourglass rank={rank.name} size={GLASS} />
                            </View>
                            {earned ? null : (
                                <View style={[styles.lock, { backgroundColor: t.color.surfaceRaised }]}>
                                    <AppIcon name="lock-closed" size={Spacing.md} color={t.color.textMuted} />
                                </View>
                            )}
                            <Text variant="caption" tone={earned ? 'primary' : 'muted'} align="center" numberOfLines={1}>{rank.name}</Text>
                            {earned ? null : <Text variant="caption" tone="muted" align="center" numberOfLines={1}>{`${(rank.min - marks).toLocaleString()} to go`}</Text>}
                        </PopIn>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    row: { gap: Spacing.lg, paddingRight: Spacing.lg },
    award: { width: GLASS, alignItems: 'center', gap: Spacing.xs },
    lock: { position: 'absolute', top: GLASS / 2 - Spacing.md, width: Spacing.xl + Spacing.xs, height: Spacing.xl + Spacing.xs, borderRadius: Spacing.lg, alignItems: 'center', justifyContent: 'center' },
});
