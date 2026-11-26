import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTokens } from '@/hooks/useTokens';
import { Spacing } from '@/theme/designSystem';
import { AppIcon } from './AppIcon';
import { Text } from './Text';

type Level = 1 | 2 | 3 | undefined;

/**
 * How urgent and how hard a habit or task is, on its card: "Urgent · Hard".
 * Only what is not the ordinary case is drawn (normal urgency and medium
 * difficulty are the defaults, so their absence says so). Each word carries
 * its own small coloured icon, so the meaning is in the word, never in the
 * colour alone. Nothing at all when both are ordinary.
 */
export function LevelTags({ priority, difficulty, dim }: { priority?: Level; difficulty?: Level; dim?: boolean }) {
    const t = useTokens();
    const tags: { key: string; icon: string; label: string; color: string }[] = [];
    if (priority === 1) tags.push({ key: 'p', icon: 'flag', label: 'Urgent', color: t.color.danger });
    else if (priority === 3) tags.push({ key: 'p', icon: 'arrow-down', label: 'Not urgent', color: t.color.textSubtle });
    if (difficulty === 3) tags.push({ key: 'd', icon: 'barbell', label: 'Hard', color: t.color.warning });
    else if (difficulty === 1) tags.push({ key: 'd', icon: 'leaf', label: 'Easy', color: t.color.success });
    if (!tags.length) return null;
    return (
        <View style={styles.row} accessible accessibilityLabel={tags.map(tag => tag.label).join(', ')}>
            {tags.map(tag => (
                <View key={tag.key} style={styles.tag}>
                    <AppIcon name={tag.icon} filled size={Spacing.md} color={dim ? t.color.textSubtle : tag.color} />
                    <Text variant="caption" tone="muted">{tag.label}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    tag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs / 2 },
});
