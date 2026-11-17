import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useChallengeOf } from '@/hooks/useChallengeOf';
import { Spacing } from '@/theme/designSystem';

const PROOF = {
    health: { icon: 'heart', word: 'Apple Health' },
    focus: { icon: 'hourglass', word: 'Focus timer' },
    photo: { icon: 'camera', word: 'Photo' },
} as const;

/**
 * On a habit or task card: it is part of a challenge, which one, and how a tick
 * is proven (a photo opens the camera; Health and the timer tick it themselves).
 * Nothing when it is not part of one.
 */
export function ChallengeTag({ kind, id }: { kind: 'habit' | 'task'; id: string }) {
    const t = useTokens();
    const challenge = useChallengeOf(kind, id);
    if (!challenge) return null;
    const proof = PROOF[challenge.proof];
    return (
        <View style={styles.row} accessible accessibilityLabel={`Part of the challenge ${challenge.title}. Proven by ${proof.word}`}>
            <AppIcon name="trophy" filled size={Spacing.md} color={t.color.accent} />
            <Text variant="caption" tone="accent" numberOfLines={1} grow>{challenge.title}</Text>
            <AppIcon name={proof.icon} size={Spacing.md} color={t.color.textMuted} />
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs / 2 },
});
