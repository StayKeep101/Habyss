import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/ui/AppIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing, elevationFor, surfaceFor } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { BUY_ME_A_COFFEE_URL, COFFEE_PRODUCT_ID } from '@/constants/brand';
import RevenueCatService from '@/lib/RevenueCat';
import type { PurchasesStoreProduct } from 'react-native-purchases';

const CLOSE = { duration: 200, easing: Easing.in(Easing.cubic) };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const COFFEE = '#C8874A';

/**
 * "Buy me a coffee", in the streak popup's clothes: a matte card that rises
 * from the bottom with a cup half out of its top edge.
 */
export function CoffeePopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { buttonColors } = useAccentGradient();
    const insets = useSafeAreaInsets();
    const { successFeedback, lightFeedback } = useHaptics();
    const [mounted, setMounted] = useState(visible);
    // The $5 coffee from the App Store, with its price in the person's currency.
    const [product, setProduct] = useState<PurchasesStoreProduct | null>(null);
    const [buying, setBuying] = useState(false);
    const [thanked, setThanked] = useState(false);
    useEffect(() => {
        if (!visible) return;
        setThanked(false);
        let alive = true;
        void RevenueCatService.getOneOff(COFFEE_PRODUCT_ID).then(found => { if (alive) setProduct(found); });
        return () => { alive = false; };
    }, [visible]);
    const progress = useSharedValue(0);
    if (visible && !mounted) setMounted(true);

    useEffect(() => {
        if (visible) { successFeedback(); progress.value = withSpring(1, { damping: 18, stiffness: 180, mass: 0.7 }); return; }
        progress.value = withTiming(0, CLOSE, finished => { if (finished) runOnJS(setMounted)(false); });
    }, [visible, progress, successFeedback]);

    const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }));
    const card = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.35, 1], [0, 1, 1]),
        transform: [{ translateY: interpolate(progress.value, [0, 1], [420, 0]) }],
    }));
    const cup = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(progress.value, [0, 0.6, 1], [0.4, 1.08, 1]) }] }));

    if (!mounted) return null;
    const close = () => { lightFeedback(); onClose(); };
    const buy = async () => {
        if (thanked) { onClose(); return; }
        if (product) {
            setBuying(true);
            const result = await RevenueCatService.buyOneOff(product);
            setBuying(false);
            if (result === 'bought') { successFeedback(); setThanked(true); }
            return;
        }
        if (BUY_ME_A_COFFEE_URL) void Linking.openURL(BUY_ME_A_COFFEE_URL).catch(() => undefined);
        onClose();
    };
    const buyLabel = thanked ? 'Thank you, truly' : buying ? 'One moment…'
        : product ? `Buy me a coffee · ${product.priceString}` : BUY_ME_A_COFFEE_URL ? 'Buy me a coffee' : 'Noted, thanks';

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
            <View style={styles.root}>
                <AnimatedPressable accessibilityLabel="Close" onPress={close} style={[StyleSheet.absoluteFill, scrim, { backgroundColor: colors.background }]} />
                <Animated.View style={[styles.card, card, elevationFor(theme, 'floating'), { paddingBottom: Math.max(insets.bottom, 14) + 6, backgroundColor: tone.fill }]}>
                    <View pointerEvents="none" style={styles.material}>
                        <LinearGradient colors={[tone.top, tone.fill, tone.bottom]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
                    </View>
                    <Animated.View style={[styles.cupWrap, cup]}>
                        <AppIcon name="cafe" size={84} color={COFFEE} />
                    </Animated.View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{thanked ? 'Coffee received' : 'Buy me a coffee'}</Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>
                        {thanked ? 'That one goes straight into the next update.' : 'Okay, the real answer: Habyss is free because one person builds it. A coffee keeps it that way.'}
                    </Text>
                    <Pressable accessibilityRole="button" onPress={() => void buy()} disabled={buying} style={styles.buttonWrap}>
                        <View style={styles.primary}>
                            <LinearGradient colors={buttonColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                            <AppIcon name="cafe" size={18} color={colors.background} />
                            <Text style={[styles.primaryText, { color: colors.background }]}>{buyLabel}</Text>
                        </View>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={close} style={styles.buttonWrap}>
                        <MatteSurface radius={Radius.control} level="control" style={styles.secondary}>
                            <Text style={[styles.secondaryText, { color: colors.textPrimary }]}>Maybe later</Text>
                        </MatteSurface>
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    card: { marginHorizontal: 10, marginBottom: 10, borderRadius: 30, paddingTop: 70, paddingHorizontal: 24, alignItems: 'center', gap: Spacing.sm },
    material: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, overflow: 'hidden' },
    cupWrap: { position: 'absolute', top: -54, alignItems: 'center', justifyContent: 'center', shadowColor: COFFEE, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
    title: { fontSize: 25, fontFamily: FontFamily.bold, letterSpacing: -0.4 },
    body: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.regular, textAlign: 'center', marginBottom: Spacing.md },
    buttonWrap: { alignSelf: 'stretch' },
    primary: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, overflow: 'hidden' },
    primaryText: { fontSize: 16, fontFamily: FontFamily.semibold },
    secondary: { paddingVertical: 16, alignItems: 'center' },
    secondaryText: { fontSize: 16, fontFamily: FontFamily.semibold },
});
