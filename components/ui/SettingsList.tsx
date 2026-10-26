import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAccentGradient } from '@/context/AccentContext';
import { textOn } from '@/theme/tokens';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, UIStyles } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { IconTile } from './IconTile';
import { VoidCard } from './VoidCard';
import { AppSwitch } from './AppSwitch';
import { MatteSurface } from './MatteSurface';

/**
 * Settings, the way iOS lays them out: groups of rows on a card, each row a
 * coloured icon tile, a name, and what it is set to. Readable without
 * reading — the tile says what it is, the right edge says what happens.
 */
export function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
    const { theme } = useTheme();
    const colors = Colors[theme] ?? Colors.abyss;
    const rows = React.Children.toArray(children).filter(Boolean);
    return (
        <View style={styles.group}>
            {title ? <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text> : null}
            <VoidCard style={styles.card}>
                {rows.map((row, index) => (
                    <View key={index}>
                        {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                        {row}
                    </View>
                ))}
            </VoidCard>
        </View>
    );
}

export function SettingsRow({ icon, color, label, value, onPress, toggle, onToggle, choices, chosen, onChoose, destructive, disabled }: {
    icon: string;
    /** The tile's colour. */
    color: string;
    label: string;
    /** What it is set to, shown before the arrow. */
    value?: string;
    onPress?: () => void;
    /** A switch instead of an arrow. */
    toggle?: boolean;
    onToggle?: (value: boolean) => void;
    /** A small inline choice instead of an arrow: "3 | 5", "Light | Dark". */
    choices?: { id: string; label: string }[];
    chosen?: string;
    onChoose?: (id: string) => void;
    destructive?: boolean;
    disabled?: boolean;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme] ?? Colors.abyss;
    const { selectionFeedback } = useHaptics();
    // A chosen option wears the colour the user picked for the app.
    const { primary: accentFill } = useAccentGradient();
    const isSwitch = toggle !== undefined;
    const pills = choices ? (
        <View style={styles.choices}>
            {choices.map(choice => {
                const on = choice.id === chosen;
                return (
                    <Pressable key={choice.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${label}: ${choice.label}`}
                        onPress={() => { if (!on) { selectionFeedback(); onChoose?.(choice.id); } }}>
                        <MatteSurface radius={999} level="control" elevation="none" tint={on ? accentFill : undefined} style={styles.choice}>
                            <Text style={[styles.choiceText, { color: on ? textOn(accentFill) : colors.textSecondary }]}>{choice.label}</Text>
                        </MatteSurface>
                    </Pressable>
                );
            })}
        </View>
    ) : null;
    // Two choices sit beside the name; more would squeeze it out, so they get
    // their own line under it.
    const stacked = !!choices && choices.length > 2;
    if (stacked) {
        return (
            <View style={[styles.stack, disabled && styles.disabled]}>
                <View style={styles.stackHead}>
                    <IconTile icon={icon} color={color} size={30} shape="square" />
                    <Text numberOfLines={2} style={[styles.label, { color: destructive ? colors.error : colors.textPrimary }]}>{label}</Text>
                </View>
                <View style={styles.stackChoices}>{pills}</View>
            </View>
        );
    }
    const content = (
        <>
            <IconTile icon={icon} color={color} size={30} shape="square" />
            <Text numberOfLines={2} style={[styles.label, { color: destructive ? colors.error : colors.textPrimary }]}>{label}</Text>
            {isSwitch ? (
                <AppSwitch value={toggle} disabled={disabled} onValueChange={next => { selectionFeedback(); onToggle?.(next); }} />
            ) : choices ? (
                pills
            ) : (
                <>
                    {value ? <Text numberOfLines={1} style={[styles.value, { color: colors.textTertiary }]}>{value}</Text> : null}
                    {onPress ? <AppIcon name="chevron-forward" size={16} color={colors.textTertiary} /> : null}
                </>
            )}
        </>
    );
    if (isSwitch || choices || !onPress) return <View style={[styles.row, disabled && styles.disabled]}>{content}</View>;
    return (
        // A static style, not a function of `pressed`: a Pressable whose style is
        // a function does not lay out as a row on this React Native, which
        // stacked the icon, the name and the arrow on top of each other.
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} disabled={disabled}
            activeOpacity={0.6} onPress={() => { selectionFeedback(); onPress(); }} style={[styles.row, disabled && styles.disabled]}>
            {content}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    group: { gap: 12 },
    title: { ...UIStyles.sectionTitle, marginBottom: 0 },
    card: { paddingHorizontal: 14 },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 42 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingVertical: 8 },
    disabled: { opacity: 0.5 },
    label: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium },
    value: { maxWidth: '45%', fontSize: 14, fontFamily: FontFamily.regular },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    stack: { gap: 10, paddingVertical: 12 },
    stackHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stackChoices: { paddingLeft: 42 },
    choice: { minWidth: 40, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
    choiceText: { fontSize: 13, fontFamily: FontFamily.medium },
});
