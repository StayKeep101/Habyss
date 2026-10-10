import React from 'react';
import { View } from 'react-native';
import { AppIcon, type IconName } from '@/components/Common/AppIcon';
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
    /** Colour of the icon and its circle; the icon sits in a tinted circle when set. */
    iconTone?: 'accent' | 'success' | 'warning' | 'danger';
    /** A small corner note, like "+4". */
    corner?: string;
}

/** A number and what it means: the building block of every stats screen. */
export function StatTile({ value, label, detail, icon, tone = 'primary', size = 'compact', align = 'center', iconTone, corner }: StatTileProps) {
    const t = useTokens();
    return (
        <View style={{ flex: size === 'compact' ? 1 : undefined, alignItems: align === 'center' ? 'center' : 'flex-start', gap: t.space.xs / 2 }}>
            {icon && iconTone ? (
                <View style={{ width: t.space['3xl'] + t.space.xs, height: t.space['3xl'] + t.space.xs, borderRadius: t.radius.full, marginBottom: t.space.xs,
                    alignItems: 'center', justifyContent: 'center', backgroundColor: t.tint('soft', ({ accent: t.color.accent, success: t.color.success, warning: t.color.warning, danger: t.color.danger })[iconTone]) }}>
                    <AppIcon name={icon} size={t.space.xl} color={({ accent: t.color.accentText, success: t.color.success, warning: t.color.warning, danger: t.color.danger })[iconTone]} />
                </View>
            ) : icon ? <AppIcon name={icon} size={t.space.lg} color={t.color.accentText} /> : null}
            <Text variant={size === 'hero' ? 'display' : 'title'} tone={tone} numeric>{value}</Text>
            <Text variant={size === 'hero' ? 'body' : 'label'} tone="muted" align={align}>{label}</Text>
            {detail ? <Text variant="caption" tone="muted" align={align}>{detail}</Text> : null}
            {corner ? (
                <View style={{ position: 'absolute', top: 0, right: 0 }}>
                    <Text variant="caption" tone={iconTone ?? 'accent'} numeric>{corner}</Text>
                </View>
            ) : null}
        </View>
    );
}
