import React from 'react';
import { View } from 'react-native';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { Text } from './Text';

export interface BadgeProps {
    label: string;
    tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
    /** A small dot before the label, for a state ("On track"). */
    dot?: boolean;
    icon?: IconName;
}

/** A small pill that states something: a status, a count, a streak. */
export function Badge({ label, tone = 'accent', dot, icon }: BadgeProps) {
    const t = useTokens();
    const color = { accent: t.color.accentText, success: t.color.success, warning: t.color.warning, danger: t.color.danger, neutral: t.color.textMuted }[tone];
    const textTone = tone === 'neutral' ? 'muted' : tone;
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: t.space.xs + t.space.xs / 2,
            paddingHorizontal: t.space.sm + t.space.xs / 2, paddingVertical: t.space.xs, borderRadius: t.radius.full,
            backgroundColor: tone === 'neutral' ? t.color.surfaceRaised : t.tint('subtle', color) }}>
            {dot ? <View style={{ width: t.space.xs + t.space.xs / 2, height: t.space.xs + t.space.xs / 2, borderRadius: t.radius.full, backgroundColor: color }} /> : null}
            {icon ? <AppIcon name={icon} size={t.space.md} color={color} /> : null}
            <Text variant="caption" tone={textTone}>{label}</Text>
        </View>
    );
}
