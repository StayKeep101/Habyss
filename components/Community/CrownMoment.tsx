import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Avatar, Confetti, Crown, Overlay, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import type { CrewPerson } from '@/lib/weekly';
import { Control, Spacing } from '@/theme/designSystem';
import { DURATION, EASE } from '@/theme/motion';

/** How long the moment holds before it goes by itself. */
const HOLD_MS = 3600;

/**
 * The crown changed hands: the crown drops in over the new holder's face,
 * one line says who took it from whom, confetti once, and it goes (or a tap
 * sends it). Everyone in the crew sees it once, the first time they open
 * Community that week. With Reduce Motion it only fades.
 */
export function CrownMoment({ king, previous, meId, onDone }: { king: CrewPerson; previous: CrewPerson; meId: string | null; onDone: () => void }) {
    const t = useTokens();
    const { successFeedback, mediumFeedback } = useHaptics();
    useEffect(() => {
        if (king.userId === meId) successFeedback(); else mediumFeedback();
        const timer = setTimeout(onDone, HOLD_MS);
        return () => clearTimeout(timer);
    }, [king.userId, meId, onDone, successFeedback, mediumFeedback]);

    const line = king.userId === meId ? `You took the crown from ${previous.name}.`
        : previous.userId === meId ? `${king.name} took your crown.`
        : `${king.name} took the crown from ${previous.name}.`;
    return (
        <Overlay onRequestClose={onDone}>
            <Animated.View entering={FadeIn.duration(DURATION.base)} exiting={FadeOut.duration(DURATION.exit)}
                style={[StyleSheet.absoluteFill, { backgroundColor: t.color.background }]}>
                <Pressable style={styles.center} onPress={onDone} accessibilityRole="button" accessibilityLabel={`${line} Tap to close.`}>
                    <Animated.View entering={FadeInDown.delay(DURATION.base).duration(DURATION.reward).easing(EASE.land)}>
                        <Crown size={Control.hitTarget + Spacing.lg} />
                    </Animated.View>
                    <Animated.View entering={ZoomIn.delay(DURATION.base).duration(DURATION.reward).easing(EASE.land)}>
                        <Avatar name={king.name} uri={king.avatarUrl} size={Control.hitTarget * 2.4} ring={t.color.warning} />
                    </Animated.View>
                    <Animated.View entering={FadeIn.delay(DURATION.reward).duration(DURATION.reward)} style={styles.words}>
                        <Text variant="caption" tone="muted" align="center">King of the Week</Text>
                        <Text variant="screenTitle" align="center">{king.userId === meId ? 'The crown is yours' : 'New crown'}</Text>
                        <Text variant="body" tone="muted" align="center">{line}</Text>
                    </Animated.View>
                </Pressable>
                <Confetti colors={[t.color.warning, t.color.accent, t.color.textPrimary]} />
            </Animated.View>
        </Overlay>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
    words: { gap: Spacing.sm },
});
