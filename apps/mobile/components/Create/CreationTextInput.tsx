import React from 'react';
import { Platform, Text, type TextInputProps } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';

/**
 * Native attributed text keeps recognized details inline without a second,
 * overlaid input. Drawn as the one field look (MatteInput), like every input.
 */
export function CreationTextInput({ text, segments, accent, textColor, ...props }: Omit<TextInputProps, 'value' | 'children'> & {
    text: string; segments: { text: string; highlighted: boolean }[]; accent: string; textColor: string;
}) {
    return <MatteInput {...props} selectionColor={accent} {...(Platform.OS === 'web' ? { value: text } : {})}>
        {Platform.OS !== 'web' ? <Text>{segments.map((part, index) =>
            <Text key={index} style={{ color: part.highlighted ? accent : textColor }}>{part.text}</Text>
        )}</Text> : null}
    </MatteInput>;
}
