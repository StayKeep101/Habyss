import React, { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTokens } from '@/hooks/useTokens';
import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
    label?: string;
    /** Shown under the field in the danger tone. */
    error?: string | null;
    hint?: string;
    size?: 'md' | 'lg';
}

/** A text field with an optional label, hint and error, from tokens only. */
export function Input({ label, error, hint, size = 'md', onFocus, onBlur, ...rest }: InputProps) {
    const t = useTokens();
    const [focused, setFocused] = useState(false);
    return (
        <View style={{ gap: t.space.xs }}>
            {label ? <Text variant="label" tone="muted">{label}</Text> : null}
            <TextInput
                {...rest}
                accessibilityLabel={rest.accessibilityLabel ?? label}
                placeholderTextColor={t.color.textMuted}
                selectionColor={t.color.accent}
                onFocus={event => { setFocused(true); onFocus?.(event); }}
                onBlur={event => { setFocused(false); onBlur?.(event); }}
                style={[
                    size === 'lg' ? t.type.title : t.type.body,
                    {
                        color: t.color.textPrimary,
                        backgroundColor: t.color.surfaceRaised,
                        borderRadius: t.radius.md,
                        borderWidth: 1,
                        borderColor: error ? t.color.danger : focused ? t.tint('border') : 'transparent',
                        paddingHorizontal: t.space.lg,
                        paddingVertical: t.space.md,
                    },
                ]}
            />
            {error ? <Text variant="caption" tone="danger">{error}</Text> : hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
        </View>
    );
}
