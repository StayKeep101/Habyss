import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';

/**
 * How big a header figure is. From the screen's width (s), so the four stats
 * beside your picture keep the same proportions on a small phone as on a big
 * one; the icon is drawn at the same size, as tall as the digits or a touch
 * taller.
 */
export const STAT_FIGURE = s(22);
const STAT_ICON = STAT_FIGURE;

/**
 * One stat in Home's header, beside your picture: its icon, then its figure,
 * the way Duolingo lays them out. No card and no label: the icon says what it
 * is, and `accessibilityLabel` says it for VoiceOver. A figure too long for
 * its share of the row shrinks a little rather than spill (a long streak,
 * "1.5h").
 */
export function HomeStatCard({ icon, glyph, tint, value, onPress, accessibilityLabel, valueRef }: {
    icon?: string;
    /** Drawn in place of `icon` (the Shard). */
    glyph?: React.ReactNode;
    tint?: string;
    value: string | number;
    /** Kept for callers; the figure is not labelled on screen. */
    label?: string;
    note?: string;
    noteTint?: string;
    onPress: () => void;
    accessibilityLabel: string;
    /** Where something flies to land on this figure (the Shards). */
    valueRef?: React.Ref<View>;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={6} style={styles.stat}>
            {glyph ?? <AppIcon filled name={icon as never} size={STAT_ICON} color={tint} />}
            <View ref={valueRef} collapsable={false} style={styles.figureBox}>
                <CountUp numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                    style={[styles.figure, { color: colors.textPrimary }]} value={value} />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    // Sized to its content; the row spreads the space between the stats evenly.
    stat: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: s(3), minHeight: 44 },
    figureBox: { flexShrink: 1 },
    figure: { fontSize: STAT_FIGURE, lineHeight: STAT_FIGURE * 1.2, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
});
