import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { Avatar } from '@/components/ui/Avatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';

/**
 * A friend's day from today, before your own day drops (lib/theDrop.ts): who
 * posted, and when it opens, nothing of what they did. Three faint lines hint
 * at a card underneath. It flips open at the drop.
 */
export function SealedDayCard({ name, avatarUrl, opensAt }: { name: string; avatarUrl?: string; opensAt: string }) {
    const t = useTokens();
    const first = name.split(' ')[0] || name;
    return (
        <VoidCard style={styles.card}>
            <View style={styles.body} accessible accessibilityLabel={`${first}'s day is posted. It opens at ${opensAt}, when yours does.`}>
                <View style={styles.head}>
                    <Avatar name={name} uri={avatarUrl} size={42} />
                    <View style={styles.text}>
                        <Text numberOfLines={1} style={[styles.name, { color: t.color.textPrimary }]}>{name}</Text>
                        <Text style={[styles.meta, { color: t.color.textMuted }]}>Day posted</Text>
                    </View>
                    <AppIcon name="lock-closed" size={18} color={t.color.textMuted} />
                </View>
                <View style={styles.lines}>
                    {[0.9, 0.7, 0.5].map(width => (
                        <View key={width} style={[styles.line, { width: `${width * 100}%`, backgroundColor: t.color.border }]} />
                    ))}
                </View>
                <Text style={[styles.opens, { color: t.color.textMuted }]}>{`Opens at ${opensAt}, with yours`}</Text>
            </View>
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: { marginBottom: Spacing.md },
    body: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    text: { flex: 1 },
    name: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 22 },
    meta: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
    lines: { gap: Spacing.sm },
    line: { height: 10, borderRadius: Radius.small },
    opens: { fontFamily: FontFamily.medium, fontSize: 13 },
});
