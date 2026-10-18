import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Wheel } from './Wheel';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, hour) => ({ id: hour, label: pad(hour) }));
const minutesFor = (step: number, current: number) => {
    const list = Array.from({ length: Math.ceil(60 / step) }, (_, index) => index * step);
    if (!list.includes(current)) list.push(current);
    return list.sort((a, b) => a - b).map(minute => ({ id: minute, label: pad(minute) }));
};

/**
 * A clock time on the app's own wheels: hours and minutes side by side, the
 * same turning wheel as everywhere else in Habyss (never the system picker).
 */
export function TimeWheels({ value, onChange, step = 5, testID }: {
    /** 24-hour "HH:MM". */
    value: string;
    onChange: (time: string) => void;
    /** Minute step; the exact current minute is always offered too. */
    step?: number;
    testID?: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [hour, minute] = value.split(':').map(Number);
    const h = Number.isFinite(hour) ? hour : 8;
    const m = Number.isFinite(minute) ? minute : 0;
    return (
        <View style={styles.row} testID={testID}>
            <Wheel options={HOURS} value={h} onChange={next => onChange(`${pad(next)}:${pad(m)}`)} style={styles.digit} />
            <Text style={[styles.colon, { color: colors.textTertiary }]}>:</Text>
            <Wheel options={minutesFor(step, m)} value={m} onChange={next => onChange(`${pad(h)}:${pad(next)}`)} style={styles.digit} />
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    colon: { fontSize: 18, fontFamily: FontFamily.bold },
    digit: { fontSize: 20, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
});
