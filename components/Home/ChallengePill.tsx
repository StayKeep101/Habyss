import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { AppIcon, MatteSurface, Text } from '@/components/ui';
import { AnimatedFill } from '@/components/ui/Motion';
import { useAccess } from '@/hooks/useAccess';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { TRIAL_DAYS, challengeDay } from '@/lib/access';
import { Control, Radius, Spacing } from '@/theme/designSystem';

/**
 * Where you are in the 14-day challenge, on Home while it runs: "Day 6 of
 * 14" and a thin bar of the fourteen. A tap opens what happens after it.
 * Gone once Habyss is yours.
 */
export function ChallengePill({ style }: { style?: StyleProp<ViewStyle> }) {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const { access } = useAccess();
    const day = challengeDay(access);
    if (day === null) return null;
    return (
        <Pressable style={style} onPress={() => { lightFeedback(); router.push('/(root)/paywall'); }} accessibilityRole="button"
            accessibilityLabel={`Day ${day} of ${TRIAL_DAYS} of your challenge. Open to see what happens after.`}>
            <MatteSurface radius={Radius.pill} level="control" style={styles.pill}>
                <AppIcon name="flag" filled size={Spacing.lg} color={t.color.accent} />
                <Text variant="caption" numeric>{`Day ${day} of ${TRIAL_DAYS}`}</Text>
                <View style={[styles.track, { backgroundColor: t.color.surfaceRaised }]}>
                    <AnimatedFill progress={day / TRIAL_DAYS} style={[styles.fill, { backgroundColor: t.color.accent }]} />
                </View>
                <Text variant="caption" tone="muted">Challenge</Text>
            </MatteSurface>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: Control.hitTarget },
    track: { flex: 1, height: Spacing.xs, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
});
