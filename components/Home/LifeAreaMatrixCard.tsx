import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { VoidCard } from '@/components/Layout/VoidCard';
import type { Habit } from '@/lib/habitsSQLite';
import { buildLifeAreaSummary, CompletionHistoryDay, LifeAreaId } from '@/lib/lifeAreaSummary';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';

interface LifeAreaMatrixCardProps {
    habits: Habit[];
    completions: Record<string, boolean>;
    history: CompletionHistoryDay[];
}

export const LifeAreaMatrixCard: React.FC<LifeAreaMatrixCardProps> = ({ habits, completions, history }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary, colors: accentColors } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    const { width } = useWindowDimensions();
    const [days, setDays] = useState<1 | 7>(7);
    const [selectedArea, setSelectedArea] = useState<LifeAreaId | null>(null);
    const [showAllHabits, setShowAllHabits] = useState(false);
    const todayKey = new Date().toDateString();
    const areas = useMemo(() => buildLifeAreaSummary({
        habits, history, completions, days, now: new Date(todayKey),
    }), [habits, history, completions, days, todayKey]);
    const selected = areas.find(area => area.id === selectedArea);
    const totals = areas.reduce((sum, area) => ({ scheduled: sum.scheduled + area.scheduled, completed: sum.completed + area.completed }), { scheduled: 0, completed: 0 });
    const hasHabits = areas.some(area => area.habits.length > 0);
    const chartSize = Math.min(Math.max(width - 72, 220), 300);
    const center = chartSize / 2;
    const radius = chartSize * 0.35;
    const coordinates = (value: number, index: number) => {
        const angle = (Math.PI * 2 * index) / areas.length - Math.PI / 2;
        return { x: center + Math.cos(angle) * radius * value, y: center + Math.sin(angle) * radius * value };
    };
    const pointsAt = (level: number) => areas.map((_, index) => {
        const point = coordinates(level, index);
        return `${point.x},${point.y}`;
    }).join(' ');
    const dataPoints = areas.map((area, index) => {
        const point = coordinates(area.rate ?? 0, index);
        return `${point.x},${point.y}`;
    }).join(' ');
    const selectArea = (id: LifeAreaId) => {
        selectionFeedback();
        setSelectedArea(current => current === id ? null : id);
        setShowAllHabits(false);
    };

    return (
        <VoidCard glass style={styles.card}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>LIFE MATRIX</Text>
                <View style={[styles.periods, { backgroundColor: colors.surfaceTertiary }]}>
                    {([1, 7] as const).map(period => (
                        <TouchableOpacity
                            key={period}
                            accessibilityRole="button"
                            accessibilityState={{ selected: period === days }}
                            onPress={() => { selectionFeedback(); setDays(period); }}
                            style={[styles.period, period === days && { backgroundColor: colors.surface }]}
                        >
                            <Text style={[styles.periodText, { color: period === days ? colors.textPrimary : colors.textSecondary }]}>{period === 1 ? 'Today' : '7 days'}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
            <Text style={[styles.description, { color: colors.textSecondary }]}>See which areas of life your habits are supporting.</Text>
            <View style={styles.chart}>
                <Svg width={chartSize} height={chartSize} accessible={false}>
                    <Defs>
                        <LinearGradient id="lifeMatrixFill" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={accentColors[0]} stopOpacity="0.5" />
                            <Stop offset="1" stopColor={accentColors[1]} stopOpacity="0.1" />
                        </LinearGradient>
                    </Defs>
                    {[0.25, 0.5, 0.75, 1].map(level => (
                        <Polygon key={level} points={pointsAt(level)} fill="none" stroke={colors.borderLight} strokeWidth={1} />
                    ))}
                    {areas.map((area, index) => {
                        const point = coordinates(1, index);
                        return <Line key={area.id} x1={center} y1={center} x2={point.x} y2={point.y} stroke={colors.borderLight} strokeWidth={1} />;
                    })}
                    <Polygon points={dataPoints} fill="url(#lifeMatrixFill)" stroke={primary} strokeWidth={2} />
                    {areas.map((area, index) => {
                        const point = coordinates(area.rate ?? 0, index);
                        const label = coordinates(1.25, index);
                        return (
                            <React.Fragment key={area.id}>
                                {area.rate !== null && <Circle cx={point.x} cy={point.y} r={selectedArea === area.id ? 5 : 3} fill={area.color} />}
                                <SvgText x={label.x} y={label.y - 3} fontSize={10} fontWeight="700" textAnchor="middle" fill={selectedArea === area.id ? area.color : colors.textSecondary} onPress={() => selectArea(area.id)}>{area.label.toUpperCase()}</SvgText>
                                <SvgText x={label.x} y={label.y + 12} fontSize={11} textAnchor="middle" fill={area.rate === null ? colors.textTertiary : colors.textPrimary} onPress={() => selectArea(area.id)}>{area.rate === null ? '—' : `${Math.round(area.rate * 100)}%`}</SvgText>
                            </React.Fragment>
                        );
                    })}
                </Svg>
            </View>
            <Text style={[styles.summary, { color: colors.textPrimary }]}>
                {totals.scheduled > 0 ? `${totals.completed} of ${totals.scheduled} planned check-ins completed` : hasHabits ? 'No check-ins scheduled in this period' : 'Your first habit starts the picture'}
            </Text>
            <Text style={[styles.explanation, { color: colors.textSecondary }]}>
                {hasHabits ? `${days === 1 ? 'Today' : 'Last 7 days, including today'}. Each area shows completed ÷ scheduled check-ins. An empty area has no plan; every area does not need equal attention.` : 'Add habits in Roadmap to see how your daily actions connect to the areas you care about.'}
            </Text>

            <View style={styles.areaGrid}>
                {areas.map(area => (
                    <TouchableOpacity
                        key={area.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${area.label}: ${area.rate === null ? 'no scheduled check-ins' : `${area.completed} of ${area.scheduled} completed`}. View habits.`}
                        accessibilityState={{ expanded: selectedArea === area.id }}
                        onPress={() => selectArea(area.id)}
                        style={[styles.areaButton, { borderColor: selectedArea === area.id ? area.color : colors.border, backgroundColor: selectedArea === area.id ? `${area.color}15` : 'transparent' }]}
                    >
                        <View style={[styles.dot, { backgroundColor: area.color }]} />
                        <Text style={[styles.areaLabel, { color: colors.textPrimary }]}>{area.label}</Text>
                        <Text style={[styles.areaValue, { color: colors.textSecondary }]}>{area.rate === null ? 'No plan' : `${Math.round(area.rate * 100)}%`}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {selected ? (
                <View style={[styles.details, { borderTopColor: colors.border }]}>
                    <View style={styles.detailHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.detailTitle, { color: selected.color }]}>{selected.label} · {selected.description}</Text>
                            <Text style={[styles.detailSubtitle, { color: colors.textSecondary }]}>{selected.scheduled > 0 ? `${selected.completed} of ${selected.scheduled} check-ins complete` : 'No scheduled check-ins in this period'}</Text>
                        </View>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close area details" onPress={() => setSelectedArea(null)} style={styles.close}>
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    {selected.habits.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active habits here. Choose this life area when creating or editing a habit.</Text>
                    ) : (showAllHabits ? selected.habits : selected.habits.slice(0, 3)).map(item => (
                        <TouchableOpacity
                            key={item.habit.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${item.habit.name}, ${item.completed} of ${item.scheduled} check-ins completed`}
                            onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: item.habit.id } })}
                            style={styles.habitRow}
                        >
                            <Ionicons name={item.dueToday && item.completedToday ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={item.dueToday && item.completedToday ? selected.color : colors.textTertiary} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text numberOfLines={1} style={[styles.habitName, { color: colors.textPrimary }]}>{item.habit.name}</Text>
                                <Text style={[styles.habitStatus, { color: colors.textSecondary }]}>{item.dueToday ? item.completedToday ? 'Done today' : 'Still to do today' : 'Not scheduled today'}</Text>
                            </View>
                            <Text style={[styles.habitCount, { color: colors.textSecondary }]}>{item.scheduled ? `${item.completed}/${item.scheduled}` : '—'}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    ))}
                    {selected.habits.length > 3 && (
                        <TouchableOpacity accessibilityRole="button" onPress={() => setShowAllHabits(value => !value)} style={styles.more}>
                            <Text style={[styles.periodText, { color: primary }]}>{showAllHabits ? 'Show fewer' : `Show all ${selected.habits.length} habits`}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : <Text style={[styles.tapHint, { color: colors.textSecondary }]}>Tap an area to see its habits</Text>}
        </VoidCard>
    );
};

const styles = StyleSheet.create({
    card: { padding: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    title: { fontFamily: 'Lexend', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
    periods: { flexDirection: 'row', padding: 3, borderRadius: 11 },
    period: { minHeight: 36, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 8 },
    periodText: { fontFamily: 'Lexend', fontSize: 11, fontWeight: '600' },
    description: { fontFamily: 'Lexend', fontSize: 12, lineHeight: 18, marginTop: 8 },
    chart: { alignItems: 'center' },
    summary: { fontFamily: 'Lexend', fontSize: 13, fontWeight: '600', textAlign: 'center' },
    explanation: { fontFamily: 'Lexend', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
    areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
    areaButton: { flexDirection: 'row', alignItems: 'center', width: '48%', flexGrow: 1, gap: 7, minHeight: 46, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    areaLabel: { fontFamily: 'Lexend', fontSize: 12, flex: 1 },
    areaValue: { fontFamily: 'Lexend', fontSize: 10 },
    details: { marginTop: 16, paddingTop: 12, borderTopWidth: 1 },
    detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailTitle: { fontFamily: 'Lexend', fontSize: 12, fontWeight: '600' },
    detailSubtitle: { fontFamily: 'Lexend', fontSize: 11, marginTop: 5 },
    close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    habitName: { fontFamily: 'Lexend', fontSize: 13 },
    habitStatus: { fontFamily: 'Lexend', fontSize: 10, marginTop: 4 },
    habitCount: { fontFamily: 'Lexend', fontSize: 12 },
    more: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontFamily: 'Lexend', fontSize: 12, lineHeight: 18, marginTop: 12 },
    tapHint: { fontFamily: 'Lexend', fontSize: 11, textAlign: 'center', marginTop: 12 },
});
