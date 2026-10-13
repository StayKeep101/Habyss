import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { useTokens } from '@/hooks/useTokens';
import type { TypeToken } from '@/theme/tokens';

export type TextTone = 'primary' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'onAccent';

export interface UITextProps extends Omit<TextProps, 'style'> {
    /** Which of the six text styles. */
    variant?: TypeToken;
    tone?: TextTone;
    align?: 'left' | 'center' | 'right';
    /** Numbers in fixed-width digits, so columns line up. */
    numeric?: boolean;
    /** Stretch to share a row (flex: 1) and shrink rather than overflow. */
    grow?: boolean;
    children?: React.ReactNode;
}

/** All text in the app: one of six styles, in one of the theme's text tones. */
export function Text({ variant = 'body', tone = 'primary', align, numeric, grow, ...rest }: UITextProps) {
    const t = useTokens();
    const color = {
        primary: t.color.textPrimary,
        muted: t.color.textMuted,
        accent: t.color.accentText,
        success: t.color.success,
        warning: t.color.warning,
        danger: t.color.danger,
        onAccent: t.color.onAccent,
    }[tone];
    return (
        <RNText
            {...rest}
            style={[
                t.type[variant],
                { color },
                align ? { textAlign: align } : null,
                numeric ? { fontVariant: ['tabular-nums'] } : null,
                grow ? { flex: 1, flexShrink: 1 } : null,
            ]}
        />
    );
}
