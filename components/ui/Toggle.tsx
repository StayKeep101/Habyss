import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
    const width = t.space['3xl'] + t.space.md;
    const knob = t.space.xl + t.space.xs;
    const travel = width - knob - t.space.xs;
    const x = useSharedValue(value ? travel : 0);
    useEffect(() => {
        x.set(withTiming(value ? travel : 0, { duration: 180, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
    }, [value, travel, x]);
    const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

    const track = (
        <View style={{ width, height: knob + t.space.xs, borderRadius: t.radius.full, padding: t.space.xs / 2, justifyContent: 'center',
            backgroundColor: value ? t.color.accent : t.color.surfaceRaised }}>
            <Animated.View style={[{ width: knob, height: knob, borderRadius: t.radius.full, backgroundColor: t.color.textPrimary }, knobStyle]} />
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
