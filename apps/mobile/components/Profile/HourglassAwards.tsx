import React, { useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon, PopIn, SectionTitle, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { RankHourglass } from '@/components/Home/RankHourglass';
import { useHaptics } from '@/hooks/useHaptics';
import { RANKS, rankFor } from '@/lib/marks';
import { chooseRankLook, shownRankLook, subscribeRankLook } from '@/lib/rankLook';
import { setThemeChoice } from '@/lib/themeChoice';
import { Spacing } from '@/theme/designSystem';

const GLASS = Spacing.section * 2.6;
/** As in the carousel: a reached hourglass dimmed into the night by this much. */
const DIM = 0.3;

/**
 * Awards: the hourglasses, one for every rank, as the carousel showed them.
 * Those reached stand in full with their name; the rest are only their black
 * shadow, with how many Marks are still to go. Yours (`choose`): tap a reached
 * one to make it your hourglass (on your profile and in Focus); "In use"
 * under the one you use.
 */
export function HourglassAwards({ marks, choose = false, onSeeAll }: { marks: number; choose?: boolean; /** › beside the title: every award, on its own page. */ onSeeAll?: () => void }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const shown = useSyncExternalStore(subscribeRankLook, shownRankLook, shownRankLook);
    const yours = rankFor(marks).rank.name;
    const inUse = shown ?? yours;
    const reached = RANKS.filter(rank => marks >= rank.min).length;
    return (
        <View style={styles.wrap}>
            <SectionTitle first right={onSeeAll ? (
                <Pressable onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={`All awards, ${reached} of ${RANKS.length} earned`} hitSlop={Spacing.md} style={styles.seeAll}>
                    <Text variant="caption" tone="muted">{`${reached} of ${RANKS.length}`}</Text>
                    <AppIcon name="chevron-forward" size={Spacing.md + 2} color={t.color.textSubtle} />
                </Pressable>
            ) : <Text variant="caption" tone="muted">{`${reached} of ${RANKS.length}`}</Text>}>Awards</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {RANKS.map((rank, index) => {
                    const earned = marks >= rank.min;
                    const using = choose && earned && rank.name === inUse;
                    const tappable = choose && earned && !using;
                    return (
                        <PopIn key={rank.name} index={index} style={styles.award}>
                            <Pressable disabled={!tappable} accessibilityRole={tappable ? 'button' : undefined}
                                accessibilityLabel={earned ? `${rank.name}, earned${using ? ', in use' : ''}` : `${rank.name}, not reached yet, ${(rank.min - marks).toLocaleString()} Marks to go`}
                                accessibilityHint={tappable ? 'Use this hourglass' : undefined}
                                onPress={() => { selectionFeedback(); chooseRankLook(rank.name === yours ? null : rank.name); setThemeChoice('hourglass'); }}
                                style={styles.press}>
                                <RankHourglass rank={rank.name} size={GLASS} look={earned ? 'scene' : 'shadow'} dim={DIM} />
                                <Text variant="caption" tone={earned ? 'primary' : 'muted'} align="center" numberOfLines={1}>{rank.name}</Text>
                                {using ? <Text variant="caption" tone="accent" align="center" numberOfLines={1}>In use</Text>
                                    : earned ? null : <Text variant="caption" tone="muted" align="center" numberOfLines={1}>{`${(rank.min - marks).toLocaleString()} to go`}</Text>}
                            </Pressable>
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
    award: { width: GLASS },
    seeAll: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: Spacing.section },
    press: { alignItems: 'center', gap: Spacing.xs, minHeight: Spacing.section },
});
