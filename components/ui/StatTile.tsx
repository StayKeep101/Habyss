import React from 'react';
import { View } from 'react-native';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { Text, type TextTone } from './Text';

export interface StatTileProps {
    value: string;
    label: string;
    /** "+4% this week" and the like, under the label. */
    detail?: string;
    icon?: IconName;
    tone?: TextTone;
    /** `hero` for the one number a screen is about; `compact` for a row of several. */
    size?: 'compact' | 'hero';
    align?: 'left' | 'center';
}

/** A number and what it means: the building block of every stats screen. */
export function StatTile({ value, label, detail, icon, tone = 'primary', size = 'compact', align = 'center' }: StatTileProps) {
    const t = useTokens();
    return (
        <View style={{ flex: size === 'compact' ? 1 : undefined, alignItems: align === 'center' ? 'center' : 'flex-start', gap: t.space.xs / 2 }}>
            {icon ? <AppIcon name={icon} size={t.space.lg} color={t.color.accentText} /> : null}
            <Text variant={size === 'hero' ? 'display' : 'title'} tone={tone} numeric>{value}</Text>
            <Text variant={size === 'hero' ? 'body' : 'label'} tone="muted" align={align}>{label}</Text>
            {detail ? <Text variant="caption" tone="muted" align={align}>{detail}</Text> : null}
        </View>
    );
}
