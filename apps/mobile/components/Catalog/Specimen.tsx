import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTokens } from '@/hooks/useTokens';

/**
 * One numbered entry in the UI catalogue: its number, its name, the file it
 * lives in, and the real component underneath. The number is what you quote
 * when asking for a change ("make #12 rounder"), so numbers never move.
 */
export function Specimen({ number, name, file, note, children }: {
    number: number;
    name: string;
    file: string;
    note?: string;
    children: React.ReactNode;
}) {
    const t = useTokens();
    return (
        <View style={{ gap: t.space.md, paddingVertical: t.space.lg, borderTopWidth: 1, borderTopColor: t.color.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                <View style={{
                    minWidth: t.space['3xl'], paddingHorizontal: t.space.sm, paddingVertical: t.space.xs / 2,
                    borderRadius: t.radius.full, backgroundColor: t.color.accent, alignItems: 'center',
                }}>
                    <Text variant="caption" tone="onAccent" numeric>#{number}</Text>
                </View>
                <Text variant="heading" grow>{name}</Text>
            </View>
            <Text variant="caption" tone="muted">{file}{note ? ` · ${note}` : ''}</Text>
            <View style={{ gap: t.space.md }}>{children}</View>
        </View>
    );
}

/** A lettered variant inside a specimen: "a · Primary". */
export function Variant({ letter, label, children }: { letter: string; label: string; children: React.ReactNode }) {
    const t = useTokens();
    return (
        <View style={{ gap: t.space.xs }}>
            <Text variant="caption" tone="muted">{letter} · {label}</Text>
            {children}
        </View>
    );
}

/** A section heading between groups of specimens. */
export function CatalogSection({ title, description }: { title: string; description: string }) {
    const t = useTokens();
    return (
        <View style={{ gap: t.space.xs, paddingTop: t.space['2xl'], paddingBottom: t.space.sm }}>
            <Text variant="title">{title}</Text>
            <Text variant="bodySmall" tone="muted">{description}</Text>
        </View>
    );
}

/** A colour sample with its role name under it. */
export function Swatch({ color, name }: { color: string; name: string }) {
    const t = useTokens();
    return (
        <View style={{ width: t.space['4xl'] * 2, gap: t.space.xs }}>
            <View style={{ height: t.space['4xl'], borderRadius: t.radius.md, backgroundColor: color, borderWidth: 1, borderColor: t.color.border }} />
            <Text variant="caption">{name}</Text>
        </View>
    );
}
