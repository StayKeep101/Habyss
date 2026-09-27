import React from 'react';
import { Platform, Text, TextInput, type TextInputProps } from 'react-native';

/** Native attributed text keeps recognized details inline without a second, overlaid input. */
export function CreationTextInput({ text, segments, accent, textColor, ...props }: Omit<TextInputProps, 'value' | 'children'> & {
    text: string; segments: { text: string; highlighted: boolean }[]; accent: string; textColor: string;
}) {
    return <TextInput {...props} selectionColor={accent} {...(Platform.OS === 'web' ? { value: text } : {})}>
        {Platform.OS !== 'web' ? <Text>{segments.map((part, index) =>
            <Text key={index} style={{ color: part.highlighted ? accent : textColor }}>{part.text}</Text>
        )}</Text> : null}
    </TextInput>;
}
