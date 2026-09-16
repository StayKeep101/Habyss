import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidModal } from '@/components/Layout/VoidModal';
import { VoidCard } from '@/components/Layout/VoidCard';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import {
    DayFocus, DayWindow, DEFAULT_DAY_WINDOW, formatMinutes, getDayWindow,
    minutesLeftInDay, parseTimeToMinutes, readFocusHistory, setDayWindow,
} from '@/lib/focusHistory';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const labelForDate = (date: string, todayKey: string, yesterdayKey: string): string => {
    if (date === todayKey) return 'Today';
    if (date === yesterdayKey) return 'Yesterday';
    const parsed = new Date(`${date}T12:00:00`);
    return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

const localKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Per-day focus history, plus the active day the "time left" metric counts against. */
export const FocusHistoryModal: React.FC<Props> = ({ visible, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary } = useAccentGradient();
    const { lightFeedback } = useHaptics();

    const [days, setDays] = useState<DayFocus[]>([]);
    const [window, setWindow] = useState<DayWindow>(DEFAULT_DAY_WINDOW);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<'start' | 'end' | null>(null);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            const [history, savedWindow] = await Promise.all([readFocusHistory(), getDayWindow()]);
            if (cancelled) return;
            setDays(history);
            setWindow(savedWindow);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [visible]);

    const commitWindow = useCallback(async (next: DayWindow) => {
        // Keep an inverted range out of storage; it would make "time left" meaningless.
        const start = parseTimeToMinutes(next.start);
        const end = parseTimeToMinutes(next.end);
        if (start === null || end === null || end <= start) return;
        setWindow(next);
        await setDayWindow(next);
    }, []);

    const today = new Date();
    const todayKey = localKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = localKey(yesterday);

    const recent = days.slice(0, 30);
    const busiest = recent.reduce((max, day) => Math.max(max, day.seconds), 0);
    const totalSeconds = recent.reduce((sum, day) => sum + day.seconds, 0);
    const leftToday = minutesLeftInDay(today, window);

    const pickerValue = (() => {
        const source = editing === 'end' ? window.end : window.start;
        const minutes = parseTimeToMinutes(source) ?? 0;
        const date = new Date();
        date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return date;
    })();

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.86}>
            <View style={{ flex: 1 }}>
                <ModalHeader
                    title="FOCUS"
                    onBack={onClose}
                    shareSummary={{
                        title: 'Focus',
                        value: formatMinutes(Math.round(totalSeconds / 60)),
                        subtitle: `across ${recent.length} day${recent.length === 1 ? '' : 's'}`,
                    }}
                />

                {loading ? (
                    <ActivityIndicator color={primary} style={{ marginVertical: 40 }} />
                ) : (
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        <VoidCard style={styles.windowCard}>
                            <View style={styles.windowHeader}>
                                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Your day</Text>
                                <Text style={{ color: primary, fontSize: 12, fontFamily: 'Lexend_500Medium' }}>
                                    {formatMinutes(leftToday)} left
                                </Text>
                            </View>
                            <Text style={[styles.caption, { color: colors.textTertiary }]}>
                                Time left is measured against these hours. Set them to match when your day really runs.
                            </Text>
                            <View style={styles.windowRow}>
                                {(['start', 'end'] as const).map(edge => (
                                    <TouchableOpacity
                                        key={edge}
                                        onPress={() => { lightFeedback(); setEditing(edge); }}
                                        style={[styles.timeChip, {
                                            backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                                            borderColor: editing === edge ? primary : 'transparent',
                                        }]}
                                    >
                                        <Text style={[styles.timeChipLabel, { color: colors.textTertiary }]}>
                                            {edge === 'start' ? 'STARTS' : 'ENDS'}
                                        </Text>
                                        <Text style={[styles.timeChipValue, { color: colors.textPrimary }]}>
                                            {edge === 'start' ? window.start : window.end}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {editing ? (
                                <View style={{ alignItems: 'center' }}>
                                    <DateTimePicker
                                        value={pickerValue}
                                        mode="time"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        themeVariant={isLight ? 'light' : 'dark'}
                                        onChange={(_event, selected) => {
                                            if (Platform.OS !== 'ios') setEditing(null);
                                            if (!selected) return;
                                            const value = `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`;
                                            commitWindow(editing === 'start' ? { ...window, start: value } : { ...window, end: value });
                                        }}
                                    />
                                    {Platform.OS === 'ios' ? (
                                        <TouchableOpacity onPress={() => setEditing(null)} style={[styles.doneBtn, { backgroundColor: primary }]}>
                                            <Text style={{ color: '#000', fontFamily: 'Lexend_600SemiBold', fontSize: 14 }}>Done</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            ) : null}
                        </VoidCard>

                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DAILY FOCUS</Text>

                        {recent.length === 0 ? (
                            <View style={styles.empty}>
                                <Ionicons name="hourglass-outline" size={30} color={colors.textTertiary} />
                                <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center' }}>
                                    No focus sessions yet. Start a timer on any habit and your days will show up here.
                                </Text>
                            </View>
                        ) : (
                            recent.map(day => {
                                const minutes = Math.round(day.seconds / 60);
                                const share = busiest > 0 ? day.seconds / busiest : 0;
                                const isToday = day.date === todayKey;
                                return (
                                    <View key={day.date} style={styles.dayRow}>
                                        <Text
                                            style={[styles.dayLabel, { color: isToday ? primary : colors.textSecondary }]}
                                            numberOfLines={1}
                                        >
                                            {labelForDate(day.date, todayKey, yesterdayKey)}
                                        </Text>
                                        <View style={[styles.barTrack, { backgroundColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)' }]}>
                                            <View style={[styles.barFill, { width: `${Math.max(share * 100, day.seconds > 0 ? 4 : 0)}%`, backgroundColor: isToday ? primary : primary + '77' }]} />
                                        </View>
                                        <View style={{ alignItems: 'flex-end', minWidth: 72 }}>
                                            <Text style={[styles.dayValue, { color: colors.textPrimary }]}>{formatMinutes(minutes)}</Text>
                                            <Text style={{ color: colors.textTertiary, fontSize: 10 }}>
                                                {day.sessions} session{day.sessions === 1 ? '' : 's'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                )}
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    content: { padding: 18, gap: 12, paddingBottom: 32 },
    windowCard: { padding: 16, gap: 10 },
    windowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
    caption: { fontSize: 11, lineHeight: 16 },
    windowRow: { flexDirection: 'row', gap: 10 },
    timeChip: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, gap: 2 },
    timeChipLabel: { fontSize: 9, letterSpacing: 1, fontFamily: 'Lexend_500Medium' },
    timeChipValue: { fontSize: 18, fontFamily: 'Lexend_600SemiBold', fontVariant: ['tabular-nums'] },
    doneBtn: { marginTop: 8, paddingHorizontal: 26, paddingVertical: 10, borderRadius: 999 },
    sectionLabel: { fontSize: 11, letterSpacing: 1, fontFamily: 'Lexend_500Medium', marginTop: 6 },
    empty: { alignItems: 'center', gap: 10, paddingVertical: 34, paddingHorizontal: 24 },
    dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
    dayLabel: { width: 84, fontSize: 12, fontFamily: 'Lexend_400Regular' },
    barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 5 },
    dayValue: { fontSize: 14, fontFamily: 'Lexend_600SemiBold', fontVariant: ['tabular-nums'] },
});
