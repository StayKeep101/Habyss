import React from 'react';
import { Pressable, View } from 'react-native';
import { useTokens } from '@/hooks/useTokens';

export interface CardProps {
    children: React.ReactNode;
    /** `raised` sits on another card; `outline` is a quiet, unfilled box. */
    variant?: 'default' | 'raised' | 'outline';
    padding?: 'md' | 'lg' | 'xl';
    gap?: 'xs' | 'sm' | 'md' | 'lg';
    elevated?: boolean;
    onPress?: () => void;
    accessibilityLabel?: string;
    /** Share a row equally with its siblings. */
    grow?: boolean;
    /** Centre what is inside, for a tile. */
    centered?: boolean;
}

/** A surface that groups related things. One per idea, not one per block. */
export function Card({ children, variant = 'default', padding = 'lg', gap = 'md', elevated, onPress, accessibilityLabel, grow, centered }: CardProps) {
    const t = useTokens();
    const style = {
        backgroundColor: variant === 'outline' ? 'transparent' : variant === 'raised' ? t.color.surfaceRaised : t.color.surface,
        borderRadius: t.radius.lg,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: t.color.border,
        padding: t.space[padding],
        gap: t.space[gap],
        flex: grow ? 1 : undefined,
        alignItems: centered ? 'center' as const : undefined,
        justifyContent: centered ? 'center' as const : undefined,
        ...(elevated ? t.elevation('card') : null),
    };
    if (!onPress) return <View style={style}>{children}</View>;
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
            style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}>
            {children}
        </Pressable>
    );
}
