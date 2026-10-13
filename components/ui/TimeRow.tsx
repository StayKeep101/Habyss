import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons, type IconName } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';

/** Timed rather than sprung, so opening the picker does not bounce the list. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/**
 * A time you can set without leaving the row.
 *
 * Tapping opens the wheel underneath rather than pushing a screen, because
 * these times are usually set in pairs — a wake and a sleep — and a round trip
 * for each one makes setting the second feel like starting again.
 */
export const TimeRow: React.FC<{
    icon: IconName;
    label: string;
    /** 24-hour "HH:MM". */
    value: string;
    accent: string;
    onChange: (time: string) => void;
}> = ({ icon, label, value, accent, onChange }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [open, setOpen] = React.useState(false);

    const [hour, minute] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hour || 0, minute || 0, 0, 0);

    return (
        <Animated.View layout={MORPH}>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${label}, ${value}`}
                accessibilityState={{ expanded: open }}
                activeOpacity={0.7}
                onPress={() => setOpen(!open)}
                style={styles.row}
            >
                <Ionicons name={icon} size={s(17)} color={colors.textTertiary} />
                <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
                <Text style={[styles.value, { color: open ? accent : colors.textSecondary }]}>{value}</Text>
            </TouchableOpacity>

            {open ? (
                <Animated.View
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(120)}
                    style={styles.picker}
                >
                    <DateTimePicker
                        value={date}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_event, selected) => {
                            if (Platform.OS !== 'ios') setOpen(false);
                            if (!selected) return;
                            onChange(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`);
                        }}
                    />
                </Animated.View>
            ) : null}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: s(12), paddingHorizontal: s(14), paddingVertical: vs(13) },
    label: { flex: 1, fontSize: ms(15), fontFamily: FontFamily.regular },
    value: { fontSize: ms(15), fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    picker: { alignItems: 'center', paddingBottom: vs(8) },
});
