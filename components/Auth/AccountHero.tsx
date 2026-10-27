import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily, Spacing } from '@/theme/designSystem';

/**
 * The top of every place Habyss offers an account: one icon, what it is in a
 * few words, and the one reason it is worth it (Apple: explain the benefit in
 * the sign-in view). The Apple and Google buttons go under it.
 */
export function AccountHero({ title, line, icon = 'cloud-upload', color }: { title: string; line: string; icon?: string; color: string }) {
    const t = useTokens();
    return (
        <View style={styles.hero}>
            <IconTile icon={icon} color={color} size={64} />
            <Text style={[styles.title, { color: t.color.textPrimary }]} accessibilityRole="header">{title}</Text>
            <Text style={[styles.line, { color: t.color.textMuted }]}>{line}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    hero: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xl, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
    title: { fontSize: 26, lineHeight: 32, fontFamily: FontFamily.bold, letterSpacing: -0.4, textAlign: 'center', marginTop: Spacing.sm },
    line: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.regular, textAlign: 'center', maxWidth: 320 },
});
