import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidCard } from '@/components/Layout/VoidCard';
import { computeInsights, type DayRecord, type Insight } from '@/lib/habitInsights';
import { updateHabit, type Habit } from '@/lib/habitsSQLite';

interface Props {
    habits: Habit[];
    history: DayRecord[];
    onChanged?: () => void;
}

const ICONS: Record<string, string> = {
    weekday_gap: 'calendar-outline',
    weekend_drop: 'trending-down-outline',
    scale_down: 'options-outline',
    holding_well: 'checkmark-circle-outline',
};

/**
 * What the numbers mean, rather than another chart.
 *
 * Everything shown is computed from recorded completions against the schedule
 * the user set. A suggestion is only ever a proposal: the target changes when
 * the user taps Apply, never automatically.
 */
export const InsightsCard: React.FC<Props> = ({ habits, history, onChanged }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [insights, setInsights] = useState<Insight[]>([]);
    const [applying, setApplying] = useState<string | null>(null);
    const [applied, setApplied] = useState<Record<string, string>>({});
    const [dismissed, setDismissed] = useState<string[]>([]);

    useEffect(() => {
        setInsights(computeInsights(habits, history));
    }, [habits, history]);

    const apply = useCallback(async (insight: Insight) => {
        const suggestion = insight.suggestion;
        if (!suggestion || applying) return;
        setApplying(insight.id);
        try {
            await updateHabit({ id: suggestion.habitId, goalValue: suggestion.toValue });
            setApplied(current => ({ ...current, [insight.id]: `Target is now ${suggestion.toValue} ${suggestion.unit}.` }));
            successFeedback();
            onChanged?.();
        } catch {
            setApplied(current => ({ ...current, [insight.id]: 'That change could not be saved. Your target is unchanged.' }));
        } finally {
            setApplying(null);
        }
    }, [applying, onChanged, successFeedback]);

    const visible = insights.filter(insight => !dismissed.includes(insight.id));
    if (visible.length === 0) return null;

    return (
        <View style={{ gap: 10 }}>
            <Text style={[styles.heading, { color: colors.textSecondary }]}>WHAT YOUR DATA SHOWS</Text>

            {visible.map(insight => {
                const note = applied[insight.id];
                return (
                    <VoidCard key={insight.id} style={styles.card}>
                        <View style={styles.row}>
                            <View style={[styles.icon, { backgroundColor: accent + '18' }]}>
                                <Ionicons name={(ICONS[insight.kind] ?? 'analytics-outline') as any} size={18} color={accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.title, { color: colors.textPrimary }]}>{insight.title}</Text>
                                <Text style={[styles.detail, { color: colors.textSecondary }]}>{insight.detail}</Text>
                            </View>
                            <TouchableOpacity
                                accessibilityLabel="Dismiss insight"
                                onPress={() => { lightFeedback(); setDismissed(current => [...current, insight.id]); }}
                                style={styles.dismiss}
                            >
                                <Ionicons name="close" size={16} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        {insight.suggestion && !note ? (
                            <View style={styles.actions}>
                                <Text style={[styles.proposal, { color: colors.textTertiary }]}>
                                    {insight.suggestion.fromValue} → {insight.suggestion.toValue} {insight.suggestion.unit}
                                </Text>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    disabled={applying === insight.id}
                                    onPress={() => { lightFeedback(); apply(insight); }}
                                    style={[styles.applyBtn, { backgroundColor: accent }]}
                                >
                                    {applying === insight.id
                                        ? <ActivityIndicator size="small" color="#000" />
                                        : <Text style={styles.applyText}>Apply</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() => { lightFeedback(); setDismissed(current => [...current, insight.id]); }}
                                    style={[styles.keepBtn, { borderColor: colors.border }]}
                                >
                                    <Text style={[styles.keepText, { color: colors.textSecondary }]}>Keep as is</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {note ? (
                            <Text style={[styles.note, { color: colors.textTertiary }]}>{note}</Text>
                        ) : null}
                    </VoidCard>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    heading: { fontSize: 11, letterSpacing: 1.5, fontFamily: 'Lexend', fontWeight: '700' },
    card: { padding: 14, gap: 10 },
    row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
    detail: { fontSize: 12, lineHeight: 18, fontFamily: 'Lexend_400Regular', marginTop: 3 },
    dismiss: { padding: 4 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    proposal: { flex: 1, fontSize: 12, fontFamily: 'Lexend_500Medium' },
    applyBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, minWidth: 74, alignItems: 'center' },
    applyText: { color: '#000', fontSize: 13, fontFamily: 'Lexend_600SemiBold' },
    keepBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
    keepText: { fontSize: 13, fontFamily: 'Lexend_500Medium' },
    note: { fontSize: 12, lineHeight: 17, fontFamily: 'Lexend_400Regular' },
});
