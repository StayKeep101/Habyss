import React from 'react';
import { Pressable, View } from 'react-native';
import { AppSwitch } from './AppSwitch';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { Text } from './Text';

export interface ToggleProps {
    value: boolean;
    onChange: (value: boolean) => void;
    /** With a label it is a whole row; without one, just the switch. */
    label?: string;
    detail?: string;
    disabled?: boolean;
}

/** One switch style for the whole app, alone or as a labelled row. */
export function Toggle({ value, onChange, label, detail, disabled }: ToggleProps) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    // The system switch (AppSwitch), the same one every on/off row uses. The
    // whole row is the target; the switch only shows the state.
    const track = (
        <View pointerEvents="none">
            <AppSwitch value={value} disabled={disabled} />
        </View>
    );
    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityLabel={label}
            accessibilityState={{ checked: value, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => { selectionFeedback(); onChange(!value); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, opacity: disabled ? 0.45 : 1,
                paddingVertical: label ? t.space.md : 0 }}
        >
            {label ? (
                <View style={{ flex: 1, gap: t.space.xs / 2 }}>
                    <Text variant="body">{label}</Text>
                    {detail ? <Text variant="caption" tone="muted" numberOfLines={1}>{detail}</Text> : null}
                </View>
            ) : null}
            {track}
        </Pressable>
    );
}
