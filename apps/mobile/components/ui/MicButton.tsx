import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Colors } from '@/theme/colors';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';

/**
 * The mic beside a text field: tap to talk instead of typing. While it
 * listens it is a solid accent disc with a soft pulse; tap again to stop.
 */
export function MicButton({ listening, onPress, size = 36 }: { listening: boolean; onPress: () => void; size?: number }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    const pulse = useSharedValue(0);
    useEffect(() => {
        pulse.value = listening
            ? withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }), -1, true)
            : withTiming(0, { duration: 150 });
    }, [listening, pulse]);
    const halo = useAnimatedStyle(() => ({ opacity: pulse.value * 0.35, transform: [{ scale: 1 + pulse.value * 0.35 }] }));

    return (
        <Pressable onPress={() => { selectionFeedback(); onPress(); }} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Talk instead of typing'} style={{ width: size, height: size }}>
            {listening ? (
                <View style={styles.center}>
                    <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: primary }, halo]} />
                    <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: primary }]}>
                        <AppIcon name="mic" size={size * 0.48} color={textOn(primary)} />
                    </View>
                </View>
            ) : (
                <MatteSurface radius={size / 2} level="control" style={[styles.center, { width: size, height: size }]}>
                    <AppIcon name="mic-outline" size={size * 0.48} color={colors.textSecondary} />
                </MatteSurface>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center' },
});
