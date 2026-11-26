import React, { useEffect } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/theme/colors';
import { Control, surfaceFor } from '@/theme/designSystem';
import { useAccentGradient } from '@/context/AccentContext';
import { MOTION } from './Motion';

/** iOS's own switch size (51×31 pt, a 27 pt thumb), so it reads as the system control. */
const WIDTH = 51;
const HEIGHT = 31;
const THUMB = 27;
const TRAVEL = WIDTH - THUMB - (HEIGHT - THUMB);

export interface AppSwitchProps {
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one switch in the app. Drawn here rather than by the system: the
 * system switch changed size in iOS 26 and React Native still lays it out at
 * the old size, so it sat off-centre in its row. This one keeps the iOS size,
 * movement and VoiceOver behaviour (a switch that says on or off), in the
 * app's colours, with a 44 pt tap area.
 */
export function AppSwitch({ value = false, onValueChange, disabled, accessibilityLabel, style }: AppSwitchProps) {
    const { theme } = useTheme();
    const { primary } = useAccentGradient();
    const off = surfaceFor(theme).raised;
    const progress = useSharedValue(value ? 1 : 0);
    useEffect(() => {
        progress.value = withTiming(value ? 1 : 0, { duration: 200, easing: MOTION.easing, reduceMotion: ReduceMotion.System });
    }, [value, progress]);
    const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.value, [0, 1], [off, primary]) }));
    const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * TRAVEL }] }));
    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: value, disabled }}
            accessibilityLabel={accessibilityLabel}
            disabled={disabled}
            hitSlop={{ top: (Control.hitTarget - HEIGHT) / 2, bottom: (Control.hitTarget - HEIGHT) / 2, left: 8, right: 8 }}
            onPress={() => onValueChange?.(!value)}
            style={[disabled && styles.disabled, style]}
        >
            <Animated.View style={[styles.track, track]}>
                <Animated.View style={[styles.thumb, { backgroundColor: Colors.common.white }, thumb]} />
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    track: { width: WIDTH, height: HEIGHT, borderRadius: HEIGHT / 2, padding: (HEIGHT - THUMB) / 2, justifyContent: 'center' },
    thumb: {
        width: THUMB, height: THUMB, borderRadius: THUMB / 2,
        shadowColor: Colors.common.black, shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    disabled: { opacity: 0.5 },
});
