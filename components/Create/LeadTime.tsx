import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { MatteInput } from '@/components/ui/MatteInput';
import { Segmented } from '@/components/ui/Segmented';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { LEAD_MAX, type LeadUnit, leadMinutes, shortLead, splitLead } from '@/lib/leadTime';

/** The answers people actually give, as numbers you can read at a glance. */
const PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440];
const presetLabel = (minutes: number) =>
    minutes === 0 ? 'On time' : minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${minutes / 60} h` : `${minutes / 1440} day`;

const UNITS: { id: LeadUnit; label: string }[] = [
    { id: 'minutes', label: 'min' },
    { id: 'hours', label: 'h' },
    { id: 'days', label: 'day' },
];

/**
 * How long before it lands.
 *
 * Two wheels of words ("Minutes", "Hours") made the reader turn a dial to find
 * out what a reminder could be. Now the common answers are numbers in one row
 * — 5 min, 15 min, 1 h, 1 day — and anything else is a number with − and +
 * beside it and the unit next to it, so "40 min" or "3 days" is two taps.
 */
export const LeadTime: React.FC<{
    /** Minutes before, as stored. */
    value: number;
    onChange: (minutes: number) => void;
    accent: string;
}> = ({ value, onChange, accent }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const light = theme === 'light';
    const { selectionFeedback } = useHaptics();
    const split = splitLead(value);
    const [unit, setUnit] = useState<LeadUnit>(value ? split.unit : 'minutes');
    const amount = value ? (split.unit === unit ? split.value : Math.max(1, Math.round(value / leadMinutes(1, unit)))) : 0;
    const [typing, setTyping] = useState<string | null>(null);
    const tile = light ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)';

    const setAmount = (next: number) => onChange(Math.min(LEAD_MAX, leadMinutes(Math.max(0, next), unit)));
    const step = (by: number) => { selectionFeedback(); setAmount((amount || 0) + by); };

    return (
        <View style={styles.wrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.presets}>
                {PRESETS.map(minutes => {
                    const on = value === minutes;
                    return (
                        <Pressable
                            key={minutes}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={minutes ? `${shortLead(minutes)}` : 'On time'}
                            onPress={() => { selectionFeedback(); setTyping(null); if (minutes) setUnit(splitLead(minutes).unit); onChange(minutes); }}
                            style={[styles.preset, { backgroundColor: on ? accent + '22' : tile, borderColor: on ? accent + '88' : 'transparent' }]}
                        >
                            <Text style={[styles.presetText, { color: on ? accent : colors.textSecondary }]}>{presetLabel(minutes)}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Anything else: a number, − and +, and what it counts. */}
            <View style={styles.custom}>
                <IconButton icon="remove" label="Less" onPress={() => step(-1)} diameter={38} size={18} color={colors.textPrimary} disabled={amount <= 0} />
                <MatteInput
                    value={typing ?? String(amount)}
                    onChangeText={text => {
                        const clean = text.replace(/[^0-9]/g, '').slice(0, 3);
                        setTyping(clean);
                        if (clean) setAmount(Number(clean));
                    }}
                    onBlur={() => setTyping(null)}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    accessibilityLabel="How long before"
                    style={[styles.amount, { color: colors.textPrimary, backgroundColor: tile }]}
                />
                <IconButton icon="add" label="More" onPress={() => step(1)} diameter={38} size={18} color={colors.textPrimary} />
                <View style={styles.units}>
                    <Segmented
                        accessibilityLabel="Unit"
                        options={UNITS}
                        value={unit}
                        onChange={next => {
                            setUnit(next);
                            // The number stays and changes meaning: 15 min becomes 15 h.
                            if (amount > 0) onChange(Math.min(LEAD_MAX, leadMinutes(amount, next)));
                        }}
                    />
                </View>
            </View>

            <Text style={[styles.reads, { color: value ? accent : colors.textTertiary }]}>
                {value ? shortLead(value) : 'Arrives right when it starts.'}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { gap: 10 },
    presets: { gap: 8 },
    preset: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 11, borderWidth: 1 },
    presetText: { fontSize: 13, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    custom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepper: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    amount: { width: 56, height: 38, borderRadius: 11, textAlign: 'center', fontSize: 17, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    units: { flex: 1 },
    reads: { fontSize: 12, fontFamily: FontFamily.medium },
});
