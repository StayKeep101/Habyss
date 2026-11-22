import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { Radius, Spacing } from '@/theme/designSystem';

/**
 * What a day's sleep or movement did to your Shards, in the corner of its
 * card: "+20 Shards" in green, or what it cost in red. The sign and the
 * word say it, not only the colour.
 */
export function EarnedChip({ amount }: { amount: number }) {
    const t = useTokens();
    const color = amount >= 0 ? t.color.success : t.color.danger;
    return (
        <View style={[styles.chip, { backgroundColor: t.tint('subtle', color) }]}>
            <AppIcon name={amount >= 0 ? 'sparkles' : 'trending-down'} size={Spacing.md} color={color} />
            <Text variant="caption" numeric tone={amount >= 0 ? 'success' : 'danger'}>{`${amount >= 0 ? '+' : ''}${amount} Shards`}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm + Spacing.xs / 2, paddingVertical: Spacing.xs / 2, borderRadius: Radius.pill },
});
