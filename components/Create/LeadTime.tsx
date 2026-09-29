import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { LEAD_UNITS, type LeadUnit, leadMinutes, shortLead, splitLead } from '@/lib/leadTime';
import { Wheel } from '@/components/Common/Wheel';

/**
 * More room on a wheel than on a row of chips, so the ordinary answers can all
 * be there — "40 minutes before" no longer has to round to 45.
 */
const AMOUNTS: Record<LeadUnit, number[]> = {
    minutes: [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 90],
    hours: [1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24],
    days: [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30],
};

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
            {/* Two wheels, how much and of what, reading left to right as the
                phrase they make: "15" / "minutes". Nineteen chips across three
                units wrapped onto three lines and stopped being a control. */}
            <View style={styles.wheels}>
                <Wheel
                    testID="lead-amount"
                    options={[{ id: 0, label: 'On time' }, ...AMOUNTS[unit].map(amount => ({ id: amount, label: String(amount) }))]}
                    value={value === 0 ? 0 : current}
                    onChange={amount => onChange(amount === 0 ? 0 : leadMinutes(Number(amount), unit))}
                />
                <Wheel
                    testID="lead-unit"
                    options={LEAD_UNITS.map(item => ({ id: item, label: UNIT_LABEL[item] }))}
                    value={unit}
                    onChange={next => {
                        const chosen = next as LeadUnit;
                        setUnit(chosen);
                        // The number stays put and changes meaning, which is
                        // what turning the right-hand wheel plainly means: 15
                        // minutes becomes 15 hours, not "the nearest hour".
                        if (value > 0) onChange(leadMinutes(splitLead(value).value, chosen));
                    }}
                />
            </View>
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
    wheels: { flexDirection: 'row', gap: 10 },
    reads: { fontSize: 12, fontFamily: FontFamily.medium },
});
