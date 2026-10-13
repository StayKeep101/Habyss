import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import type { TaskPriority } from '@/lib/tasks';

/**
 * The small facts a row should give up without being opened.
 *
 * Whether it will remind you, what it measures, how urgent it is: all things
 * you would otherwise have to tap the card to learn. They are deliberately
 * quiet — a row is mostly a name, and a badge that competes with the name has
 * taken more than it gives.
 */

/** Muted by default; only what is actually set is drawn at full strength. */
const DIM = 0.55;

export const ReminderBadge: React.FC<{ on: boolean; size?: number }> = ({ on, size }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    if (!on) return null;
    return (
        <Ionicons
            name="notifications"
            size={size ?? s(11)}
            color={colors.textTertiary}
            accessibilityLabel="Reminder set"
        />
    );
};

/** What a numeric habit is asking for, as "2 books" rather than a bare number. */
export const MeasureBadge: React.FC<{ value?: number; unit?: string }> = ({ value, unit }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const name = (unit ?? '').trim();
    // "1 times" reads as a mistake; the unit is only pluralised when it earns it.
    const label = name
        ? `${amount} ${amount === 1 ? name.replace(/s$/, '') : name}`
        : `${amount}`;

    return (
        <View style={[styles.chip, { borderColor: colors.border }]}>
            <Text numberOfLines={1} style={[styles.chipText, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );
};

/**
 * Priority, marked only when it is not the ordinary case.
 *
 * Urgent gets two exclamation marks, which is read instantly and in any
 * language. Low gets a quiet arrow pointing down. Normal gets nothing at all —
 * it is the default, and once the other two are marked its absence says so
 * without spending a pixel.
 */
export const PriorityFlag: React.FC<{ priority: TaskPriority; size?: number }> = ({ priority, size }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    if (priority === 3) {
        return (
            <Ionicons
                name="arrow-down"
                size={size ?? s(11)}
                color={colors.textTertiary}
                style={{ opacity: DIM }}
                accessibilityLabel="Low priority"
            />
        );
    }

    if (priority !== 1) return null;

    return (
        <Text
            accessibilityLabel="High priority"
            style={[styles.urgent, { color: colors.error, fontSize: size ?? ms(13) }]}
        >
            !!
        </Text>
    );
};

/** Lays the badges out in a row, and disappears entirely when there are none. */
export const BadgeRow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const shown = React.Children.toArray(children).filter(Boolean);
    if (shown.length === 0) return null;
    return <View style={styles.row}>{shown}</View>;
};

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
    chip: {
        paddingHorizontal: s(6),
        paddingVertical: 1,
        borderRadius: s(6),
        borderWidth: StyleSheet.hairlineWidth,
    },
    chipText: { fontSize: ms(9), fontFamily: FontFamily.medium },
    urgent: { fontFamily: FontFamily.bold, letterSpacing: -0.5, lineHeight: ms(15) },
});
