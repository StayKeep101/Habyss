import React from 'react';
import { Pressable, View } from 'react-native';
import { AppIcon, type IconName } from '@/components/Common/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { Text } from './Text';

export interface HabitRowProps {
    title: string;
    /** "Every day · 07:00", "3 in a row". */
    meta?: string;
    icon?: IconName;
    /** The habit's own colour; the accent when unset. */
    color?: string;
    done: boolean;
    /** Tasks are squares, habits are circles. */
    kind?: 'habit' | 'task';
    /** Right-hand detail: a time, a count, a duration. */
    trailing?: string;
    onToggle: () => void;
    onPress?: () => void;
    /** `plain` sits inside a card with no surface of its own. */
    variant?: 'card' | 'plain';
}

/** One habit or task in a list: its check, its name, and one line about it. */
export function HabitRow({ title, meta, icon, color, done, kind = 'habit', trailing, onToggle, onPress, variant = 'card' }: HabitRowProps) {
    const t = useTokens();
    const tintColor = color ?? t.color.accent;
    const box = t.space.xl + t.space.xs / 2;
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}${meta ? `, ${meta}` : ''}${done ? ', done' : ''}`}
            onPress={onPress ?? onToggle}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: t.space.md, paddingVertical: t.space.md,
                paddingHorizontal: variant === 'plain' ? 0 : t.space.lg, borderRadius: t.radius.md,
                backgroundColor: variant === 'plain' ? 'transparent' : t.color.surface, opacity: pressed ? 0.85 : 1 })}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={done ? `Undo ${title}` : `Complete ${title}`}
                hitSlop={t.space.sm} onPress={onToggle}
                style={{ width: box, height: box, borderRadius: kind === 'task' ? t.radius.sm / 2 + 1 : t.radius.full, borderWidth: 2,
                    borderColor: done ? tintColor : t.color.border, backgroundColor: done ? tintColor : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {done ? <AppIcon name="checkmark" size={t.space.md + t.space.xs / 2} color={t.color.onAccent} /> : null}
            </Pressable>
            {icon ? (
                <View style={{ width: t.space['3xl'], height: t.space['3xl'], borderRadius: t.radius.sm, backgroundColor: t.tint('subtle', tintColor), alignItems: 'center', justifyContent: 'center' }}>
                    <AppIcon name={icon} size={t.space.lg} color={tintColor} />
                </View>
            ) : null}
            <View style={{ flex: 1, gap: t.space.xs / 2 }}>
                <Text variant={variant === 'plain' ? 'body' : 'heading'} tone={done ? 'muted' : 'primary'} strike={done} numberOfLines={1}>{title}</Text>
                {meta ? <Text variant="caption" tone="muted" numberOfLines={1}>{meta}</Text> : null}
            </View>
            {trailing ? <Text variant="caption" tone="muted" numeric>{trailing}</Text> : null}
        </Pressable>
    );
}
