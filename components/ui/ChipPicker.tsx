import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { textOn } from '@/theme/tokens';
import { MatteSurface } from '@/components/ui/MatteSurface';
import Animated, { Easing, LinearTransition, ReduceMotion, FadeIn } from 'react-native-reanimated';
import { AppIcon as Ionicons, type IconName } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

export interface ChipOption<T extends string> {
    id: T;
    label: string;
    icon?: IconName;
    /** Shown under the row, but only while this one is chosen. */
    detail?: string;
}

/** Timed, never sprung: a sprung height overshoots and the row visibly bounces. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/**
 * A list of choices, in the room of about two.
 *
 * A settings page that gives every option its own full-width row with an icon
 * and a paragraph spends most of its height describing things you are not
 * choosing. This keeps the whole set visible as a row of chips and shows the
 * description for the one that is actually selected, which is the only one
 * that describes what the app is currently doing.
 *
 * Nothing is lost: every label stays on screen, and the detail you would have
 * read is the detail still shown.
 */
export function ChipPicker<T extends string>({ options, value, onChange, accent }: {
    options: ChipOption<T>[];
    value: T;
    onChange: (id: T) => void;
    accent: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();

    const chosen = options.find(option => option.id === value);

    return (
        <View style={styles.wrap}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
                keyboardShouldPersistTaps="handled"
            >
                {options.map(option => {
                    const on = option.id === value;
                    return (
                        <Pressable
                            hitSlop={8}
                            key={option.id}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={option.label}
                            onPress={() => { if (!on) { selectionFeedback(); onChange(option.id); } }}
                        >
                        {/* The matte pill every chip is. The chosen one is filled
                            solid with the accent, still matte — like Phantom's
                            selected tab — with dark or light text, whichever reads. */}
                        <MatteSurface radius={999} level="control" tint={on ? accent : undefined} style={styles.chip}>
                            {option.icon ? (
                                <Ionicons name={option.icon} size={s(13)} color={on ? textOn(accent) : colors.textTertiary} />
                            ) : null}
                            <Text
                                numberOfLines={1}
                                style={[styles.chipText, { color: on ? textOn(accent) : colors.textSecondary }, on && styles.chipTextOn]}
                            >
                                {option.label}
                            </Text>
                        </MatteSurface>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {chosen?.detail ? (
                <Animated.View layout={MORPH}>
                    <Animated.Text
                        key={chosen.id}
                        entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
                        style={[styles.detail, { color: colors.textTertiary }]}
                    >
                        {chosen.detail}
                    </Animated.Text>
                </Animated.View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { paddingVertical: vs(10), gap: vs(8) },
    strip: { flexDirection: 'row', gap: s(8), paddingHorizontal: s(14), paddingVertical: vs(6) },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(6),
        paddingHorizontal: s(12),
        paddingVertical: vs(8),
    },
    chipText: { fontSize: ms(13), fontFamily: FontFamily.medium },
    chipTextOn: { fontFamily: FontFamily.semibold },
    detail: { fontSize: ms(12), lineHeight: ms(17), fontFamily: FontFamily.regular, paddingHorizontal: s(14) },
});
