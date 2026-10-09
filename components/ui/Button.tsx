import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { AppIcon, type IconName } from '@/components/Common/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { Text } from './Text';

export interface ButtonProps {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg';
    icon?: IconName;
    disabled?: boolean;
    loading?: boolean;
    /** Fill the width of its container. */
    block?: boolean;
    accessibilityHint?: string;
}

/** Every button: four kinds, three sizes, built only from tokens. */
export function Button({ label, onPress, variant = 'primary', size = 'md', icon, disabled, loading, block, accessibilityHint }: ButtonProps) {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const fill = {
        primary: t.color.accent,
        secondary: t.color.surfaceRaised,
        ghost: 'transparent',
        destructive: t.tint('soft', t.color.danger),
    }[variant];
    const ink = { primary: t.color.onAccent, secondary: t.color.textPrimary, ghost: t.color.accentText, destructive: t.color.danger }[variant];
    const height = { sm: t.space['3xl'], md: t.space['4xl'] + t.space.xs, lg: t.space['4xl'] + t.space.md }[size];
    const pad = { sm: t.space.md, md: t.space.lg, lg: t.space.xl }[size];
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
            disabled={disabled || loading}
            onPress={() => { lightFeedback(); onPress(); }}
            style={({ pressed }) => ({
                minHeight: height,
                paddingHorizontal: pad,
                borderRadius: t.radius.full,
                backgroundColor: fill,
                alignSelf: block ? 'stretch' : 'flex-start',
                opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
                justifyContent: 'center',
            })}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space.sm }}>
                {loading ? <ActivityIndicator color={ink} /> : icon ? <AppIcon name={icon} size={t.space.lg + t.space.xs / 2} color={ink} /> : null}
                <Text variant={size === 'sm' ? 'caption' : 'heading'} tone={variant === 'primary' ? 'onAccent' : variant === 'destructive' ? 'danger' : variant === 'ghost' ? 'accent' : 'primary'}>
                    {label}
                </Text>
            </View>
        </Pressable>
    );
}
