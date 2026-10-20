import React from 'react';
import { Text, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ListItem } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import type { Pattern } from '@/lib/echoPatterns';

/**
 * What Echo found in your record, one card per pattern: the finding, and the
 * numbers it stands on underneath. Nothing shows until there is enough data.
 */
export function PatternList({ patterns, title = 'Your patterns', limit = 6, empty }: {
    patterns: Pattern[];
    title?: string;
    limit?: number;
    /** Said when nothing is clear yet; nothing at all when left out. */
    empty?: string;
}) {
    const t = useTokens();
    if (!patterns.length && !empty) return null;
    return (
        <View>
            <SectionTitle>{title}</SectionTitle>
            {patterns.length ? patterns.slice(0, limit).map((pattern, index) => (
                <ListItem key={pattern.id} index={index}>
                    <VoidCard style={{ gap: t.space.xs, marginBottom: t.space.sm }}>
                        <Text style={[t.type.body, { color: t.color.textPrimary }]}>{pattern.text}</Text>
                        <Text style={[t.type.caption, { color: t.color.textSubtle }]}>{pattern.evidence}</Text>
                    </VoidCard>
                </ListItem>
            )) : (
                <Text style={[t.type.bodySmall, { color: t.color.textSubtle }]}>{empty}</Text>
            )}
        </View>
    );
}
