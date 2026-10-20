import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, ReduceMotion, ZoomIn, ZoomOut, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { s, ms } from '@/theme/scale';
import { FontFamily } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE = { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * You, with today drawn around you.
 *
 * The ring is how much of today is kept — the habits due and the promise of
 * things to finish, counted together as one day's work. Empty when nothing is
 * done, closed when it all is, and it turns green at the moment it closes so
 * the day being won is visible from across the room.
 *
 * It replaces a ring that was always full, which said nothing at all.
 *
 * While perfect days are multiplying your Marks, the multiplier sits on the
 * picture's bottom-right edge, like a badge.
 */
export const ProgressAvatar: React.FC<{
    uri?: string | null;
    done: number;
    total: number;
    onPress: () => void;
    /** The perfect-day Marks multiplier; shown only above ×1. */
    multiplier?: number;
}> = ({ uri, done, total, onPress, multiplier = 1 }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary } = useAccentGradient();

    const size = s(52);
    const stroke = s(3);
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
    const complete = total > 0 && done >= total;

    const filled = useSharedValue(0);
    useEffect(() => { filled.value = withTiming(ratio, EASE); }, [ratio, filled]);
    const ring = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - filled.value) }));

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${total > 0 ? `Your profile. ${done} of ${total} done today.` : 'Your profile.'}${multiplier > 1 ? ` Marks ×${multiplier}.` : ''}`}
            activeOpacity={0.8}
            onPress={onPress}
            style={{ width: size, height: size }}
        >
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                {/* The track only shows once the day has asked for something. */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.12)'}
                    strokeWidth={stroke}
                    fill="none"
                    opacity={total > 0 ? 1 : 0}
                />
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={complete ? colors.success : primary}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${circumference} ${circumference}`}
                    animatedProps={ring}
                    rotation={-90}
                    origin={`${size / 2}, ${size / 2}`}
                />
            </Svg>

            <View style={[styles.inner, {
                width: size - stroke * 2 - s(3),
                height: size - stroke * 2 - s(3),
                borderRadius: (size - stroke * 2 - s(3)) / 2,
                margin: stroke + s(1.5),
                backgroundColor: colors.background,
            }]}>
                {uri ? (
                    <Image source={{ uri }} style={styles.photo} />
                ) : (
                    <View style={[styles.placeholder, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)' }]}>
                        <Ionicons name="person" size={s(20)} color={colors.textSecondary} />
                    </View>
                )}
            </View>

            {multiplier > 1 ? (
                <Animated.View entering={ZoomIn.duration(260)} exiting={ZoomOut.duration(180)} pointerEvents="none"
                    style={[styles.badge, { backgroundColor: primary, borderColor: colors.background }]}>
                    <Text style={[styles.badgeText, { color: textOn(primary) }]}>×{multiplier}</Text>
                </Animated.View>
            ) : null}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    inner: { overflow: 'hidden' },
    photo: { width: '100%', height: '100%' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // Over the ring's bottom-right edge, ringed in the page colour so it reads as sitting on top.
    badge: {
        position: 'absolute', right: -s(6), bottom: -s(3), minWidth: s(24), height: s(18),
        paddingHorizontal: s(5), borderRadius: s(9), borderWidth: s(2), alignItems: 'center', justifyContent: 'center',
    },
    badgeText: { fontFamily: FontFamily.bold, fontSize: ms(10), fontVariant: ['tabular-nums'] },
});
