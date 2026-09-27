import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { Choices } from '@/components/Create/DetailBar';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { LEAD_AMOUNTS, LEAD_UNITS, type LeadUnit, amountLabel, leadMinutes, shortLead, splitLead } from '@/lib/leadTime';

/** Timed, never sprung: the row swaps its amounts and a spring would bounce. */
const MORPH = LinearTransition.duration(200).easing(Easing.out(Easing.cubic));

const UNIT_LABEL: Record<LeadUnit, string> = { minutes: 'Minutes', hours: 'Hours', days: 'Days' };

/**
 * How long before it lands.
 *
 * Four buttons — on time, 5, 15, 30 — could only ever say "in a moment". A
 * reminder you have to prepare for wants an hour; one about a weekly shop wants
 * the day before.
 *
 * Rather than nineteen buttons, the unit chooses which five are on screen. The
 * unit row is not itself an answer, so choosing one leaves the reminder where it
 * was until an amount is tapped — except that "On time" lives with the amounts,
 * because that is the answer it is, not a unit.
 */
export const LeadTime: React.FC<{
    /** Minutes before, as stored. */
    value: number;
    onChange: (minutes: number) => void;
    accent: string;
}> = ({ value, onChange, accent }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const chosen = splitLead(value);
    const [unit, setUnit] = useState<LeadUnit>(chosen.unit);

    // The amount is only lit when this unit is the one the value is said in.
    const current = chosen.unit === unit ? chosen.value : -1;

    return (
        <Animated.View layout={MORPH} style={styles.wrap}>
            <Choices
                options={LEAD_UNITS.map(item => ({ id: item, label: UNIT_LABEL[item] }))}
                value={unit}
                accent={accent}
                onChange={setUnit}
            />
            <Choices
                options={[
                    { id: 0, label: 'On time' },
                    ...LEAD_AMOUNTS[unit].map(amount => ({ id: amount, label: amountLabel(amount, unit) })),
                ]}
                value={value === 0 ? 0 : current}
                accent={accent}
                onChange={amount => onChange(amount === 0 ? 0 : leadMinutes(amount, unit))}
            />
            {value > 0 ? (
                <Animated.Text layout={MORPH} entering={FadeIn.duration(160)} style={[styles.reads, { color: accent }]}>
                    {shortLead(value)}
                </Animated.Text>
            ) : (
                <Text style={[styles.reads, { color: colors.textTertiary }]}>Arrives when the habit starts.</Text>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrap: { gap: 8 },
    reads: { fontSize: 12, fontFamily: FontFamily.medium },
});
