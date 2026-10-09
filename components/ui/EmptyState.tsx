import React from 'react';
import { View } from 'react-native';
import { AppIcon, type IconName } from '@/components/Common/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { Text } from './Text';
import { Button } from './Button';

export interface EmptyStateProps {
    icon: IconName;
    title: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
}

/** What a place shows before it has anything in it, and how to fill it. */
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
    const t = useTokens();
    return (
        <View style={{ alignItems: 'center', gap: t.space.sm, paddingVertical: t.space['3xl'], paddingHorizontal: t.space.xl }}>
            <AppIcon name={icon} size={t.space['3xl']} color={t.color.textMuted} />
            <Text variant="heading" align="center">{title}</Text>
            {message ? <Text variant="caption" tone="muted" align="center">{message}</Text> : null}
            {actionLabel && onAction ? <View style={{ marginTop: t.space.sm }}><Button label={actionLabel} onPress={onAction} size="sm" variant="secondary" /></View> : null}
        </View>
    );
}
