import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentOrDefault } from '@/hooks/useAccentOrDefault';
import { Radius } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';

/** Where the field sits and how big it is: the box takes these. */
const LAYOUT = new Set([
    'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'flex', 'flexGrow', 'flexShrink', 'flexBasis',
    'alignSelf', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
    'position', 'top', 'bottom', 'left', 'right', 'zIndex',
]);
/** The look of a box: the field owns it, so every field matches. */
const BOX = /^(backgroundColor|border|shadow|elevation|overflow)/;

/**
 * The one text field look, as a drop-in for TextInput.
 *
 * Any input in the app is this: the matte control surface (gradient, a faint
 * light edge, a small shadow), rounded, with the edge turning to the accent
 * while you type. Pass the same `style` a TextInput takes — its size and
 * position go to the box, its text styles stay on the text, and any box look
 * it carried (a background, a border) is replaced, so no field can drift.
 */
export const MatteInput = forwardRef<TextInput, TextInputProps & { invalid?: boolean; boxStyle?: StyleProp<ViewStyle> }>(
    function MatteInput({ style, onFocus, onBlur, invalid, boxStyle, placeholderTextColor, selectionColor, ...props }, ref) {
        const { theme } = useTheme();
        const colors = Colors[theme];
        const { foreground } = useAccentOrDefault();
        const [focused, setFocused] = useState(false);
        const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle & Record<string, unknown>;
        const box: Record<string, unknown> = {};
        const text: Record<string, unknown> = {};
        let radius: number = Radius.control;
        for (const [key, value] of Object.entries(flat)) {
            if (key === 'borderRadius' && typeof value === 'number') radius = value;
            else if (LAYOUT.has(key)) box[key] = value;
            else if (!BOX.test(key)) text[key] = value;
        }
        // An input that never had a box of its own gets the room a field needs.
        if (!Object.keys(flat).some(key => key.startsWith('padding'))) text.paddingHorizontal = 12;
        if (box.height === undefined && box.minHeight === undefined) box.minHeight = 40;
        if (box.minHeight !== undefined) text.minHeight = Math.max(0, Number(box.minHeight) - 2);
        if (box.height !== undefined) text.height = Math.max(0, Number(box.height) - 2);
        return (
            <MatteSurface
                radius={radius}
                level="control"
                edge={invalid ? colors.error : focused ? foreground : undefined}
                style={[box as ViewStyle, boxStyle]}
            >
                <TextInput
                    ref={ref}
                    placeholderTextColor={placeholderTextColor ?? colors.textTertiary}
                    selectionColor={selectionColor ?? foreground}
                    {...props}
                    onFocus={event => { setFocused(true); onFocus?.(event); }}
                    onBlur={event => { setFocused(false); onBlur?.(event); }}
                    style={[{ color: colors.textPrimary }, text as TextStyle]}
                />
            </MatteSurface>
        );
    },
);
