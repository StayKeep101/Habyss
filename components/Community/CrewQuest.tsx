import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp, PopIn } from '@/components/ui/Motion';
import { FaceStack } from '@/components/ui/FaceStack';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { questStanding, type CrewMember } from '@/lib/crewQuest';

/** The most stars drawn; past that, each star stands for a few show-ups. */
const MAX_STARS = 40;

/**
 * This week's crew quest: a constellation that lights up a star for every
 * show-up anyone in the crew makes, how far it has got (25 of 30 by Sunday),
 * and the faces of who brought what. Reached, it turns into the crew's trophy.
 */
export function CrewQuest({ members, style }: { members: CrewMember[]; style?: StyleProp<ViewStyle> }) {
    const t = useTokens();
    const { done, target, reached, crew } = questStanding(members);
    if (crew.length < 2) return null;
    const stars = Math.min(target, MAX_STARS);
    const per = target / stars;
    const lit = Math.min(stars, Math.floor(done / per));
    const left = Math.max(0, target - done);
    return (
        <View style={style}>
            <SectionTitle first>Crew quest</SectionTitle>
            <VoidCard style={styles.card}>
                <View style={styles.head} accessible accessibilityLabel={reached ? `Crew quest done: ${done} show-ups this week` : `${done} of ${target} show-ups by Sunday`}>
                    {reached ? <AppIcon name="trophy" filled size={26} color={t.color.silver} /> : null}
                    <CountUp style={[styles.big, { color: reached ? t.color.silver : t.color.textPrimary }]} value={done} />
                    <Text style={[styles.of, { color: t.color.textMuted }]}>{reached ? 'show-ups. Quest done' : `of ${target} show-ups by Sunday`}</Text>
                </View>
                {/* One star per show-up (or per few, on a big crew), lit as they come. */}
                <View style={styles.sky} importantForAccessibility="no-hide-descendants">
                    {Array.from({ length: stars }, (_, index) => (
                        <PopIn key={index} index={index}>
                            <AppIcon name="star" filled size={14} color={index < lit ? (reached ? t.color.silver : t.color.cobalt) : t.color.border} />
                        </PopIn>
                    ))}
                </View>
                <View style={styles.crew}>
                    <FaceStack faces={crew} size={26} shown={5} />
                    <Text numberOfLines={2} style={[styles.who, { color: t.color.textMuted }]}>
                        {reached ? 'Everyone helped. Same again next week?'
                            : `${left} to go · ${crew.slice(0, 3).map(member => `${member.mine ? 'You' : member.name.split(' ')[0]} ${member.showUps}`).join(', ')}`}
                    </Text>
                </View>
            </VoidCard>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    big: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 36, fontVariant: ['tabular-nums'] },
    of: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15 },
    sky: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    crew: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    who: { flex: 1, fontFamily: FontFamily.medium, fontSize: 13 },
});
