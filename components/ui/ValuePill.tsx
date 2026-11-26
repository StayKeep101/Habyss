import React from 'react';
import { StyleSheet } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

/** A number on the right of a row, in a small matte pill — Phantom's "46%". */
export const ValuePill: React.FC<{ value: string; tone?: string }> = ({ value, tone }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <MatteSurface radius={999} level="control" elevation="none" style={styles.pill}>
            <CountUp style={[styles.pillText, { color: tone ?? colors.textPrimary }]} value={value} />
        </MatteSurface>
    );
};

const styles = StyleSheet.create({
    pill: { minWidth: 58, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center' },
    pillText: { fontSize: 14, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
});
