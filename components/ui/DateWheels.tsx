import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Wheel, WheelBand } from './Wheel';
import { FontFamily, Spacing } from '@/theme/designSystem';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/**
 * A date on the app's own wheels — day, month, year — for things like a
 * birthday. A day that does not exist in the new month (31 → February) is
 * moved to the month's last day.
 */
export function DateWheels({ value, onChange, minYear = 1900, maxDate = new Date() }: {
    value: Date;
    onChange: (date: Date) => void;
    minYear?: number;
    maxDate?: Date;
}) {
    const year = value.getFullYear();
    const month = value.getMonth();
    const day = value.getDate();
    const maxYear = maxDate.getFullYear();
    const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => ({ id: maxYear - index, label: String(maxYear - index) }));
    const days = Array.from({ length: daysIn(year, month) }, (_, index) => ({ id: index + 1, label: String(index + 1) }));
    const months = MONTHS.map((label, index) => ({ id: index, label }));
    const set = (y: number, m: number, d: number) => {
        const next = new Date(y, m, Math.min(d, daysIn(y, m)), 12);
        onChange(next > maxDate ? maxDate : next);
    };
    return (
        <View style={styles.row}>
            {/* One band across the three, like the iPhone's date picker. */}
            <WheelBand />
            <Wheel band={false} options={days} value={day} onChange={next => set(year, month, next)} style={styles.text} />
            <Wheel band={false} options={months} value={month} onChange={next => set(year, next, day)} style={styles.text} />
            <Wheel band={false} options={years} value={year} onChange={next => set(next, month, day)} style={styles.text} />
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch' },
    text: { fontSize: 18, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
});
