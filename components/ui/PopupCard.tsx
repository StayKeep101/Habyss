import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing, elevationFor, surfaceFor } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { sheetBottom } from './sheetBottom';
import { OVERLAY } from '@/theme/motion';
import { useHaptics } from '@/hooks/useHaptics';
import { useUISound } from '@/hooks/useUISound';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The pop-up the streak celebration uses, for anything short: a matte card
 * that rises from the bottom with a big icon half out of its top edge, a
 * title, a line, and whatever choices it carries. Tap outside to close.
 */
export function PopupCard({ visible, onClose, icon, iconColor, title, body, children, badge: picture }: {
    visible: boolean;
    onClose: () => void;
    icon: string;
    iconColor: string;
    title: string;
    body?: string;
    children?: React.ReactNode;
    /** Drawn on the top edge in place of the icon: a face, for a card about a person. */
    badge?: React.ReactNode;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const insets = useSafeAreaInsets();
    const { lightFeedback } = useHaptics();
    const appear = useUISound('open');
    const [mounted, setMounted] = useState(visible);
    const progress = useSharedValue(0);
    if (visible && !mounted) setMounted(true);

    useEffect(() => {
        // The same way in and out as every overlay (theme/motion.ts): no spring, no bounce.
        if (visible) { appear(); progress.value = withTiming(1, OVERLAY.in); return; }
        progress.value = withTiming(0, OVERLAY.out, finished => { if (finished) runOnJS(setMounted)(false); });
    }, [visible, progress]); // eslint-disable-line react-hooks/exhaustive-deps -- the sound plays as it opens, not when the setting changes

    const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }));
    const card = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.35, 1], [0, 1, 1]),
        transform: [{ translateY: interpolate(progress.value, [0, 1], [420, 0]) }],
    }));
    const badge = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(progress.value, [0, 0.6, 1], [0.4, 1.08, 1]) }] }));

    if (!mounted) return null;
    const close = () => { lightFeedback(); onClose(); };

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
            <View style={styles.root}>
                <AnimatedPressable accessibilityLabel="Close" onPress={close} style={[StyleSheet.absoluteFill, scrim, { backgroundColor: colors.background }]} />
                <Animated.View style={[styles.card, card, elevationFor(theme, 'floating'), { paddingBottom: sheetBottom(insets.bottom), backgroundColor: tone.fill }]}>
                    <View pointerEvents="none" style={styles.material}>
                        <LinearGradient colors={[tone.top, tone.fill, tone.bottom]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
                    </View>
                    <Animated.View style={[styles.badge, badge, { shadowColor: iconColor }]}>
                        {picture ?? <AppIcon name={icon as never} filled size={76} color={iconColor} />}
                    </Animated.View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                    {body ? <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text> : null}
                    {children}
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    card: { marginHorizontal: 10, marginBottom: 10, borderRadius: 30, paddingTop: 62, paddingHorizontal: 22, alignItems: 'stretch', gap: Spacing.sm },
    material: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, overflow: 'hidden' },
    badge: { position: 'absolute', top: -48, alignSelf: 'center', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
    title: { fontSize: 23, fontFamily: FontFamily.bold, letterSpacing: -0.4, textAlign: 'center' },
    body: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.regular, textAlign: 'center', marginBottom: Spacing.sm },
});
