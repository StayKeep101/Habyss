import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, LinearTransition, ReduceMotion, FadeIn } from 'react-native-reanimated';
import { AppIcon as Ionicons, type IconName } from '@/components/Common/AppIcon';
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
    const isLight = theme === 'light';
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
                            key={option.id}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={option.label}
                            onPress={() => { if (!on) { selectionFeedback(); onChange(option.id); } }}
                            style={[styles.chip, {
                                backgroundColor: on ? accent + '22' : isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                                borderColor: on ? accent + '66' : colors.border,
                            }]}
                        >
                            {option.icon ? (
                                <Ionicons name={option.icon} size={s(13)} color={on ? accent : colors.textTertiary} />
                            ) : null}
                            <Text
                                numberOfLines={1}
                                style={[styles.chipText, { color: on ? accent : colors.textSecondary }]}
                            >
                                {option.label}
                            </Text>
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
    strip: { flexDirection: 'row', gap: s(8), paddingHorizontal: s(14) },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(6),
        paddingHorizontal: s(12),
        paddingVertical: vs(8),
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    chipText: { fontSize: ms(13), fontFamily: FontFamily.medium },
    detail: { fontSize: ms(12), lineHeight: ms(17), fontFamily: FontFamily.regular, paddingHorizontal: s(14) },
});
