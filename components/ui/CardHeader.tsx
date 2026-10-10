import React from 'react';
import { View } from 'react-native';
import { AppIcon, type IconName } from '@/components/Common/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { Text } from './Text';

export interface CardHeaderProps {
    title: string;
    icon?: IconName;
    /** A short value on the right, like "0/3" or a count. */
    trailing?: string;
    /** Show a chevron: the card opens something. */
    chevron?: boolean;
    children?: React.ReactNode;
}

/** The top line of a card: a label, and what it leads to. */
export function CardHeader({ title, icon, trailing, chevron, children }: CardHeaderProps) {
    const t = useTokens();
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            {icon ? <AppIcon name={icon} size={t.space.lg} color={t.color.accentText} /> : null}
            <Text variant="label" tone="muted" grow>{title}</Text>
            {children}
            {trailing || chevron ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, paddingHorizontal: t.space.sm + t.space.xs / 2,
                    paddingVertical: t.space.xs, borderRadius: t.radius.full, backgroundColor: t.color.surfaceRaised }}>
                    {trailing ? <Text variant="caption" tone="muted" numeric>{trailing}</Text> : null}
                    {chevron ? <AppIcon name="chevron-forward" size={t.space.md} color={t.color.textMuted} /> : null}
                </View>
            ) : null}
        </View>
    );
}
