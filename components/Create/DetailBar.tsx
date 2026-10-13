import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppIcon as Ionicons, type IconName } from '@/components/Common/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

/** Default compact panel; a calendar or wheel can reserve the space it needs. */
const PANEL_HEIGHT = 186;
const OPEN = { duration: 190, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
const CLOSE = { duration: 150, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System };

export interface DetailItem {
    id: string;
    icon: IconName;
    color?: string;
    panelHeight?: number;
    fixedContent?: boolean;
    /** What the setting is called, shown on the chip when it is not set. */
    label: string;
    /** What it is set to, shown on the chip instead of the label. */
    value?: string;
    content: React.ReactNode;
}

/**
 * Everything a new habit, goal or task can carry, on one line above the
 * keyboard.
 *
 * The rows used to live in the page, which meant the keyboard covered them the
 * moment you started typing: you wrote the name, dismissed the keyboard,
 * scrolled, set the time, scrolled back. Here they are chips that sit directly
 * on top of the keyboard, the way Reminders does it, and the one you tap opens
 * over them — so the sentence, the settings and the save button are all in
 * reach at once and nothing is ever hidden.
 *
 * Nothing here springs. Each panel reserves its own height that slides open on a
 * timing curve. Choosing something inside a panel can change its chip text
 * or reveal a picker without moving that panel's controls. A spring overshoots by design, which is the wobble
 * you see when a control resizes under your thumb.
 *
 * A chip reads as its value once it has one, because "Fridays" tells you more
 * than "Repeat" does.
 */
export const DetailBar: React.FC<{
    items: DetailItem[];
    open: string | null;
    onToggle: (id: string | null) => void;
    accent: string;
    fitContent?: boolean;
}> = ({ items, open, onToggle, accent, fitContent = false }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { selectionFeedback } = useHaptics();
    const { height: screenHeight } = useWindowDimensions();
    const stableHeight = Math.round(Math.min(440, Math.max(260, screenHeight * 0.46)));

    // A setting can stop being offered while its panel is open — a goal drops
    // "Starting from" the moment its target stops being relative to one — so
    // what counts as open is what is actually still there to show.
    const openId = items.some(item => item.id === open) ? open : null;

    // The panel keeps drawing what it held while it closes, so the content
    // does not vanish a frame before the panel does. Only the id is
    // remembered, so what it draws is always the live control.
    const [lastOpen, setLastOpen] = useState<string | null>(openId);
    if (openId && openId !== lastOpen) setLastOpen(openId);
    const shown = items.find(item => item.id === (fitContent ? openId : openId ?? lastOpen)) ?? null;

    const panelHeight = shown?.panelHeight ?? PANEL_HEIGHT;
    const height = useSharedValue(openId ? panelHeight : 0);
    useEffect(() => {
        height.value = withTiming(openId ? panelHeight : 0, openId ? OPEN : CLOSE);
    }, [openId, height, panelHeight]);

    const panelStyle = useAnimatedStyle(() => ({
        height: height.value,
        opacity: Math.min(1, height.value / panelHeight),
    }));

    return (
        <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            {/* One height for every setting, sized to this phone. A panel that
                sized itself to its contents made the whole card jump each time
                you switched tabs or changed something inside one — the cheap,
                wobbly feeling. Now only the contents scroll, and only if they
                must. */}
            <Animated.View testID="detail-panel" style={[styles.panel, fitContent ? { height: shown ? stableHeight : 0 } : panelStyle]}>
                {shown ? (
                    <>
                        <View style={styles.panelHead}>
                            <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>{shown.label}</Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Close ${shown.label}`}
                                hitSlop={10}
                                onPress={() => { selectionFeedback(); onToggle(null); }}
                            >
                                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
                            </Pressable>
                        </View>
                        {shown.fixedContent && !fitContent ? <View style={styles.panelContent}>{shown.content}</View> : <ScrollView
                            bounces={false}
                            // Shrinks when space runs out (a keyboard opened from
                            // inside the panel), and scrolls, rather than pushing
                            // the chips under the save button.
                            style={fitContent ? styles.panelScroll : undefined}
                            // Stays put at its edges rather than rubber-banding
                            // the panel around under your thumb.
                            overScrollMode="never"
                            contentContainerStyle={[styles.panelContent, fitContent && { flexGrow: 0 }]}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {shown.content}
                        </ScrollView>}
                    </>
                ) : null}
            </Animated.View>

            <ScrollView
                horizontal
                bounces={false}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                // Never squeezed: the chips are how you get anywhere else.
                style={styles.chipRow}
                contentContainerStyle={styles.chips}
            >
                {items.map(item => {
                    const isOpen = item.id === openId;
                    const isSet = !!item.value || !!item.color;
                    const tint = item.color ?? accent;
                    return (
                        <Pressable
                            key={item.id}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: isOpen }}
                            accessibilityLabel={`${item.label}${item.value ? `, ${item.value}` : ''}`}
                            onPress={() => {
                                selectionFeedback();
                                // A picker needs the room the keyboard is using,
                                // and you cannot type into one anyway.
                                if (!isOpen) Keyboard.dismiss();
                                onToggle(isOpen ? null : item.id);
                            }}
                            // Static style: a function style loses the chip's
                            // layout on this React Native.
                            style={[styles.chip, {
                                backgroundColor: isOpen || isSet ? tint + '1f' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)'),
                                borderColor: isOpen ? tint : (isSet ? tint + '4d' : 'transparent'),
                            }]}
                        >
                            <Ionicons name={item.icon} size={14} color={item.color ?? (isOpen || isSet ? accent : colors.textSecondary)} />
                            <Text numberOfLines={1} style={[styles.chipText, { color: isOpen || isSet ? colors.textPrimary : colors.textSecondary }]}>
                                {item.value || item.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

/** The chips a panel opens onto, shared so every setting looks alike. */
export const Choices = <T,>({ options, value, onChange, accent, multiple }: {
    options: { id: T; label: string }[];
    value: T | T[];
    onChange: (id: T) => void;
    accent: string;
    multiple?: boolean;
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { selectionFeedback } = useHaptics();
    const selected = (id: T) => (multiple ? (value as T[]).includes(id) : value === id);

    return (
        <View style={styles.choices}>
            {options.map(option => {
                const on = selected(option.id);
                return (
                    <Pressable
                        key={String(option.id)}
                        accessibilityRole={multiple ? 'checkbox' : 'radio'}
                        accessibilityState={{ selected: on }}
                        onPress={() => { selectionFeedback(); onChange(option.id); }}
                        style={[styles.choice, {
                            backgroundColor: on ? accent + '20' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                            borderColor: on ? accent + '66' : 'transparent',
                        }]}
                    >
                        <Text style={[styles.choiceText, { color: on ? accent : colors.textSecondary }]}>{option.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, flexShrink: 1, minHeight: 0 },
    // overflow hidden so the content is clipped by the sliding height rather
    // than spilling over the chips on the way open.
    panel: { paddingHorizontal: 16, overflow: 'hidden', flexShrink: 1, minHeight: 0 },
    panelScroll: { flex: 1 },
    chipRow: { flexGrow: 0, flexShrink: 0 },
    panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 26 },
    panelTitle: { fontSize: 13, fontFamily: FontFamily.semibold },
    panelContent: { gap: 10, paddingBottom: 8, flexGrow: 1 },
    chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: 1,
        // No cap: the chip says what the setting is, and a rule like "Every 2
        // months on the third Sunday" is useless cut off at "Every 2 mont…".
        // The row scrolls sideways, so a long one costs nothing but its width.
    },
    chipText: { fontSize: 13, fontFamily: FontFamily.medium },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, borderWidth: 1 },
    choiceText: { fontSize: 13, fontFamily: FontFamily.medium },
});
