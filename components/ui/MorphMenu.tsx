import React, { useImperativeHandle, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, interpolate, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { Control, FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';

export interface MorphMenuItem {
    label: string;
    icon: IconName;
    onPress: () => void;
    destructive?: boolean;
}

const WIDTH = 248;
const ROW = 48;
const HEAD = 52;
/** Room kept between the menu and the edges of the screen. */
const MARGIN = 12;
// Timed, not sprung: a spring overshoots, which read as the button jumping before it opened.
const OPEN = { duration: 240, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
const CLOSE = { duration: 170, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * A "⋯" button that grows into its own menu.
 *
 * The round button stretches, from where it sits, into a matte window with a
 * small title and one row per option — icon and label, destructive ones in
 * red — then folds back into the button. Replaces the system action sheet so
 * menus look like the rest of the app. An option runs after the menu has
 * closed, so an alert it raises is never hidden behind it.
 *
 * It drops down from the button (or grows up from it, when the button sits
 * at the bottom of the screen), wherever the button is and on any
 * screen: positioned against the layer it is drawn in (measured, not assumed —
 * a page presented as a sheet sits lower than the screen), opening leftwards
 * from a button on the right and rightwards from one on the left, and never
 * taller than the room above the home indicator (it scrolls if it must).
 */
/** For opening the menu from elsewhere (a long press on the page, say). */
export interface MorphMenuHandle { open: () => void }

export function MorphMenu({ items, title, titleIcon = 'ellipsis-horizontal', label = 'More options', diameter = Control.hitTarget, style, pageHeight, icon = 'ellipsis-horizontal', iconColor, menuRef }: {
    /** The button's glyph, when it is not "⋯" (the × that ends a focus). */
    icon?: IconName;
    iconColor?: string;
    menuRef?: React.Ref<MorphMenuHandle>;
    /**
     * The height of the page the button is on, when that page is presented as
     * a sheet. A sheet sits lower than the screen, and the button's measured
     * position does not include that, so the menu appeared above the button
     * and then moved. With it, the menu opens exactly where the button is.
     */
    pageHeight?: number;
    items: MorphMenuItem[];
    title?: string;
    titleIcon?: IconName;
    label?: string;
    diameter?: number;
    style?: StyleProp<ViewStyle>;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();
    const insets = useSafeAreaInsets();
    const trigger = useRef<View>(null);
    const layerRef = useRef<View>(null);
    const [anchor, setAnchor] = useState<{ x: number; y: number; width: number } | null>(null);
    const [layer, setLayer] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const progress = useSharedValue(0);
    const fullHeight = HEAD + items.length * ROW + Spacing.sm;
    useImperativeHandle(menuRef, () => ({ open }));

    const open = () => {
        lightFeedback();
        trigger.current?.measureInWindow((x, y, width) => {
            progress.value = 0;
            setLayer(null);
            setAnchor({ x, y, width: width || diameter });
        });
    };

    /** Where the menu's own layer sits on screen; the menu opens once this is known. */
    const measureLayer = () => {
        layerRef.current?.measureInWindow((x, y, width, height) => {
            setLayer({ x, y, width, height });
            progress.value = withTiming(1, OPEN);
        });
    };

    const close = (then?: () => void) => {
        progress.value = withTiming(0, CLOSE, finished => {
            if (finished) runOnJS(finish)(then);
        });
    };
    // What was chosen runs once the menu's window is really gone: a sheet asked
    // for while it was still closing was refused by iOS, so nothing opened.
    const pending = useRef<(() => void) | null>(null);
    const finish = (then?: () => void) => {
        pending.current = then ?? null;
        setAnchor(null);
        setLayer(null);
        // iOS says when the window is gone (onDismiss); elsewhere, a moment later.
        if (Platform.OS !== 'ios') setTimeout(runPending, 60);
    };
    const runPending = () => {
        const then = pending.current;
        pending.current = null;
        then?.();
    };

    // The button's place inside the layer, then which way the menu can open.
    const place = anchor && layer ? (() => {
        // A sheet's own offset from the top of the screen (it is flush with the bottom).
        const sheetTop = pageHeight && pageHeight < layer.height ? layer.height - pageHeight : 0;
        const top = anchor.y + sheetTop - layer.y;
        const left = anchor.x - layer.x;
        const rightEdge = left + anchor.width;
        const width = Math.min(WIDTH, layer.width - MARGIN * 2);
        const fromRight = rightEdge - width >= MARGIN;
        const room = layer.height - top - Math.max(insets.bottom, MARGIN);
        // Near the bottom of the screen (a bar above the home indicator) it
        // grows upwards instead, from the button's bottom edge.
        const above = top + diameter - Math.max(insets.top, MARGIN);
        const up = room < fullHeight && above > room;
        const height = Math.min(fullHeight, Math.max(diameter, up ? above : room));
        return {
            top: up ? top + diameter - height : top,
            up,
            width,
            height,
            side: fromRight
                ? { right: layer.width - rightEdge }
                : { left: Math.max(MARGIN, Math.min(left, layer.width - width - MARGIN)) },
            fromRight,
        };
    })() : null;
    const width = place?.width ?? WIDTH;
    const height = place?.height ?? fullHeight;

    const windowStyle = useAnimatedStyle(() => ({
        width: interpolate(progress.value, [0, 1], [diameter, width]),
        height: interpolate(progress.value, [0, 1], [diameter, height]),
        borderRadius: interpolate(progress.value, [0, 1], [diameter / 2, Radius.card]),
    }));
    const contentStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.5, 1], [0, 1], 'clamp') }));
    const scrolls = height < fullHeight;
    const dotsStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.4], [1, 0], 'clamp'),
        transform: [{ rotate: `${progress.value * 90}deg` }],
    }));
    const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.35 }));
    const closeButton = (
        <Pressable onPress={() => close()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close menu">
            <AppIcon name="close" size={18} color={colors.textTertiary} />
        </Pressable>
    );

    return (
        <>
            <Pressable ref={trigger} onPress={open} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={style}>
                {/* Stays visible until the window is drawn over it, so the button never blinks out first. */}
                <MatteSurface radius={diameter / 2} level="control" style={[styles.disc, { width: diameter, height: diameter, opacity: anchor && layer ? 0 : 1 }]}>
                    <AppIcon name={icon} size={Control.icon} color={iconColor ?? colors.textPrimary} />
                </MatteSurface>
            </Pressable>

            <Modal visible={!!anchor} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()} onDismiss={runPending}>
                <View ref={layerRef} style={StyleSheet.absoluteFill} onLayout={measureLayer} pointerEvents="box-none">
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close menu">
                        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, scrimStyle]} />
                    </Pressable>
                    {place ? (
                        <Animated.View style={[styles.window, { top: place.top }, place.side, windowStyle]} accessibilityViewIsModal>
                            <MatteSurface radius={Radius.card} elevation="floating" style={StyleSheet.absoluteFill}>
                                <Animated.View style={[styles.dots, place.up ? styles.dotsUp : null, place.fromRight ? styles.dotsRight : styles.dotsLeft, { width: diameter, height: diameter }, dotsStyle]} pointerEvents="none">
                                    <AppIcon name={icon} size={Control.icon} color={colors.textPrimary} />
                                </Animated.View>
                                <Animated.View style={[styles.content, { width }, contentStyle]}>
                                    {/* The close on the side the window grew from, where the
                                        button was: left for a button on the left, right otherwise. */}
                                    <View style={[styles.head, { height: HEAD }]}>
                                        {place.fromRight ? null : closeButton}
                                        <View style={[styles.logo, { backgroundColor: primary }]}>
                                            <AppIcon name={titleIcon} size={13} color={colors.background} />
                                        </View>
                                        <Text numberOfLines={1} style={[styles.title, { color: colors.textSecondary }]}>{title ?? 'Options'}</Text>
                                        {place.fromRight ? closeButton : null}
                                    </View>
                                    <ScrollView scrollEnabled={scrolls} bounces={false} showsVerticalScrollIndicator={scrolls}>
                                        {items.map(item => (
                                            <TouchableOpacity
                                                key={item.label}
                                                accessibilityRole="button"
                                                onPress={() => { selectionFeedback(); close(item.onPress); }}
                                                activeOpacity={0.6}
                                                style={[styles.row, { height: ROW, borderTopColor: colors.border }]}
                                            >
                                                <AppIcon name={item.icon} size={18} color={item.destructive ? colors.error : colors.textPrimary} />
                                                <Text numberOfLines={1} style={[styles.rowLabel, { color: item.destructive ? colors.error : colors.textPrimary }]}>{item.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </Animated.View>
                            </MatteSurface>
                        </Animated.View>
                    ) : null}
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    disc: { alignItems: 'center', justifyContent: 'center' },
    window: { position: 'absolute', overflow: 'hidden' },
    dots: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center' },
    dotsUp: { top: undefined, bottom: 0 },
    dotsRight: { right: 0 },
    dotsLeft: { left: 0 },
    content: { flex: 1 },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
    logo: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
    rowLabel: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15 },
});
