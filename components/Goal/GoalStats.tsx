import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { Habit, calculateGoalProgress, getCompletions, getHabitStats, isHabitScheduledForDate } from '@/lib/habitsSQLite';
import { VoidCard } from '@/components/Layout/VoidCard';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Line, Path, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { runOnJS } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 96;
const CHART_HEIGHT = 220;
const WEEKLY_WIDTH = width - 96;
const WEEKLY_HEIGHT = 160;

interface GoalStatsProps {
    goal: Habit;
    habits: Habit[];
}

type DailyPoint = {
    date: string;
    label: string;
    completed: number;
    expected: number;
    ratio: number;
};

type WeeklyPoint = {
    label: string;
    completed: number;
    expected: number;
    ratio: number;
};

type HabitBreakdown = {
    id: string;
    name: string;
    color: string;
    completed: number;
    expected: number;
    completionRate: number;
    currentStreak: number;
    bestStreak: number;
};

type DashboardState = {
    progress: number;
    totalCompleted: number;
    totalExpected: number;
    remaining: number;
    completedToday: number;
    executionRate30d: number;
    momentumDelta: number;
    averageDailyCompletions: number;
    requiredDailyPace: number;
    bestDay: DailyPoint | null;
    dailySeries: DailyPoint[];
    weeklySeries: WeeklyPoint[];
    breakdown: HabitBreakdown[];
};

const toLocalISO = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getRecentDays = (count: number) => {
    const days: string[] = [];
    const today = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        days.push(toLocalISO(date));
    }
    return days;
};

const getFutureDayWindow = (goal: Habit) => {
    if (!goal.targetDate) {
        return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(goal.targetDate);
    target.setHours(0, 0, 0, 0);
    const diff = target.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / 86400000));
};

export const GoalStats: React.FC<GoalStatsProps> = ({ goal, habits }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const accentColor = goal.color || colors.primary;
    const { selectionFeedback } = useHaptics();
    const [dashboard, setDashboard] = useState<DashboardState>({
        progress: 0,
        totalCompleted: 0,
        totalExpected: 1,
        remaining: 0,
        completedToday: 0,
        executionRate30d: 0,
        momentumDelta: 0,
        averageDailyCompletions: 0,
        requiredDailyPace: 0,
        bestDay: null,
        dailySeries: [],
        weeklySeries: [],
        breakdown: [],
    });
    const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

    useEffect(() => {
        let isActive = true;

        const loadDashboard = async () => {
            const linkedHabits = habits.filter((habit) => habit.goalId === goal.id && !habit.isArchived);
            if (linkedHabits.length === 0) {
                if (isActive) {
                    setDashboard((prev) => ({
                        ...prev,
                        progress: 0,
                        totalCompleted: 0,
                        totalExpected: 1,
                        remaining: 0,
                        completedToday: 0,
                        executionRate30d: 0,
                        momentumDelta: 0,
                        averageDailyCompletions: 0,
                        requiredDailyPace: 0,
                        bestDay: null,
                        dailySeries: [],
                        weeklySeries: [],
                        breakdown: [],
                    }));
                }
                return;
            }

            const progress = await calculateGoalProgress(goal);
            const recent30Days = getRecentDays(30);
            const recent56Days = getRecentDays(56);
            const allDates = Array.from(new Set([...recent30Days, ...recent56Days, toLocalISO(new Date())]));
            const completionsMap = new Map<string, Record<string, boolean>>();

            await Promise.all(
                allDates.map(async (date) => {
                    const completions = await getCompletions(date);
                    completionsMap.set(date, completions);
                })
            );

            const breakdownStats = await Promise.all(
                linkedHabits.map(async (habit) => {
                    const habitStats = await getHabitStats(habit.id);
                    const expected = recent30Days.reduce((sum, date) => {
                        const scheduled = isHabitScheduledForDate(habit, new Date(`${date}T12:00:00`));
                        return sum + (scheduled ? 1 : 0);
                    }, 0);

                    return {
                        id: habit.id,
                        name: habit.name,
                        color: habit.color || accentColor,
                        completed: habitStats.totalCompletions,
                        expected,
                        completionRate: habitStats.completionRate,
                        currentStreak: habitStats.currentStreak,
                        bestStreak: habitStats.bestStreak,
                    };
                })
            );

            const dailySeries = recent30Days.map((date) => {
                const dayCompletions = completionsMap.get(date) || {};
                const expected = linkedHabits.reduce((sum, habit) => {
                    const scheduled = isHabitScheduledForDate(habit, new Date(`${date}T12:00:00`));
                    return sum + (scheduled ? 1 : 0);
                }, 0);
                const completed = linkedHabits.reduce((sum, habit) => {
                    return sum + (dayCompletions[habit.id] ? 1 : 0);
                }, 0);

                return {
                    date,
                    label: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    completed,
                    expected,
                    ratio: expected > 0 ? completed / expected : 0,
                };
            });

            const weeklySeries: WeeklyPoint[] = [];
            for (let i = 0; i < recent56Days.length; i += 7) {
                const chunk = recent56Days.slice(i, i + 7);
                const completed = chunk.reduce((sum, date) => {
                    const dayCompletions = completionsMap.get(date) || {};
                    return sum + linkedHabits.reduce((inner, habit) => inner + (dayCompletions[habit.id] ? 1 : 0), 0);
                }, 0);
                const expected = chunk.reduce((sum, date) => {
                    return sum + linkedHabits.reduce((inner, habit) => {
                        const scheduled = isHabitScheduledForDate(habit, new Date(`${date}T12:00:00`));
                        return inner + (scheduled ? 1 : 0);
                    }, 0);
                }, 0);

                weeklySeries.push({
                    label: `${new Date(`${chunk[0]}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                    completed,
                    expected,
                    ratio: expected > 0 ? completed / expected : 0,
                });
            }

            const totalExpected = breakdownStats.reduce((sum, item) => sum + item.expected, 0);
            const totalCompleted = dailySeries.reduce((sum, day) => sum + day.completed, 0);
            const completedToday = dailySeries[dailySeries.length - 1]?.completed || 0;
            const executionRate30d = totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0;
            const last7 = dailySeries.slice(-7);
            const previous7 = dailySeries.slice(-14, -7);
            const last7Rate = last7.reduce((sum, day) => sum + day.completed, 0) / Math.max(1, last7.reduce((sum, day) => sum + day.expected, 0));
            const previous7Rate = previous7.reduce((sum, day) => sum + day.completed, 0) / Math.max(1, previous7.reduce((sum, day) => sum + day.expected, 0));
            const momentumDelta = Math.round((last7Rate - previous7Rate) * 100);
            const averageDailyCompletions = Number((totalCompleted / Math.max(1, dailySeries.length)).toFixed(1));
            const bestDay = dailySeries.reduce<DailyPoint | null>((best, day) => {
                if (!best || day.completed > best.completed) {
                    return day;
                }
                return best;
            }, null);
            const remaining = Math.max(0, totalExpected - totalCompleted);
            const daysToGoal = getFutureDayWindow(goal);
            const requiredDailyPace = daysToGoal > 0 ? Number((remaining / daysToGoal).toFixed(1)) : 0;

            if (!isActive) {
                return;
            }

            setDashboard({
                progress,
                totalCompleted,
                totalExpected: Math.max(1, totalExpected),
                remaining,
                completedToday,
                executionRate30d,
                momentumDelta,
                averageDailyCompletions,
                requiredDailyPace,
                bestDay,
                dailySeries,
                weeklySeries,
                breakdown: breakdownStats.sort((a, b) => b.completionRate - a.completionRate),
            });
        };

        loadDashboard();

        return () => {
            isActive = false;
        };
    }, [goal, habits, colors.primary, accentColor]);

    const chartMax = useMemo(() => {
        const maxCompleted = Math.max(...dashboard.dailySeries.map((point) => point.completed), 1);
        const maxExpected = Math.max(...dashboard.dailySeries.map((point) => point.expected), 1);
        return Math.max(maxCompleted, maxExpected);
    }, [dashboard.dailySeries]);

    const chartPoints = useMemo(() => {
        return dashboard.dailySeries.map((point, index) => {
            const x = dashboard.dailySeries.length > 1 ? (index / (dashboard.dailySeries.length - 1)) * CHART_WIDTH : 0;
            const y = CHART_HEIGHT - (point.completed / Math.max(1, chartMax)) * (CHART_HEIGHT - 28) - 8;
            return { x, y, ...point };
        });
    }, [dashboard.dailySeries, chartMax]);

    const linePath = useMemo(() => {
        if (chartPoints.length === 0) {
            return '';
        }

        return chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    }, [chartPoints]);

    const fillPath = useMemo(() => {
        if (chartPoints.length === 0) {
            return '';
        }

        const first = chartPoints[0];
        const last = chartPoints[chartPoints.length - 1];
        return `${linePath} L ${last.x} ${CHART_HEIGHT} L ${first.x} ${CHART_HEIGHT} Z`;
    }, [chartPoints, linePath]);

    const selectedPoint = selectedPointIndex !== null ? chartPoints[selectedPointIndex] : null;

    const chartGesture = Gesture.Pan()
        .onBegin((event) => {
            if (chartPoints.length === 0) {
                return;
            }

            const raw = (event.x / CHART_WIDTH) * (chartPoints.length - 1);
            const index = Math.max(0, Math.min(chartPoints.length - 1, Math.round(raw)));
            runOnJS(setSelectedPointIndex)(index);
            runOnJS(selectionFeedback)();
        })
        .onUpdate((event) => {
            if (chartPoints.length === 0) {
                return;
            }

            const raw = (event.x / CHART_WIDTH) * (chartPoints.length - 1);
            const index = Math.max(0, Math.min(chartPoints.length - 1, Math.round(raw)));
            runOnJS(setSelectedPointIndex)(index);
        })
        .onFinalize(() => {
            runOnJS(setSelectedPointIndex)(null);
        });

    const gridColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
    const softColor = isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)';

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>GOAL INTELLIGENCE</Text>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Momentum dashboard</Text>
                </View>
                <View style={[styles.liveBadge, { backgroundColor: softColor }]}>
                    <Ionicons name="pulse-outline" size={14} color={accentColor} />
                    <Text style={[styles.liveBadgeText, { color: colors.textSecondary }]}>Live analysis</Text>
                </View>
            </View>

            <VoidCard glass style={[styles.heroCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
                <View style={styles.heroTop}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.heroLabel, { color: colors.textTertiary }]}>Goal Progress Index</Text>
                        <Text style={[styles.heroValue, { color: accentColor }]}>{dashboard.progress}%</Text>
                        <Text style={[styles.heroHint, { color: colors.textSecondary }]}>
                            {dashboard.momentumDelta >= 0 ? 'Momentum accelerating' : 'Momentum cooling'}
                            {' '}by {Math.abs(dashboard.momentumDelta)} pts vs last week
                        </Text>
                    </View>
                    <View style={styles.heroDialWrap}>
                        <Svg width={112} height={112}>
                            <Defs>
                                <SvgGradient id="goalDial" x1="0" y1="0" x2="1" y2="1">
                                    <Stop offset="0" stopColor={accentColor} stopOpacity="1" />
                                    <Stop offset="1" stopColor="#38BDF8" stopOpacity="1" />
                                </SvgGradient>
                            </Defs>
                            <Circle cx="56" cy="56" r="42" stroke={softColor} strokeWidth="12" fill="none" />
                            <Circle
                                cx="56"
                                cy="56"
                                r="42"
                                stroke="url(#goalDial)"
                                strokeWidth="12"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={`${(dashboard.progress / 100) * 264} 264`}
                                transform="rotate(-90 56 56)"
                            />
                            <SvgText
                                x="56"
                                y="63"
                                fill={colors.textPrimary}
                                fontSize="22"
                                fontFamily="Lexend_700Bold"
                                textAnchor="middle"
                            >
                                {dashboard.executionRate30d}%
                            </SvgText>
                        </Svg>
                        <Text style={[styles.heroDialLabel, { color: colors.textTertiary }]}>30-day execution</Text>
                    </View>
                </View>

                <View style={styles.metricsGrid}>
                    <View style={[styles.metricCard, { backgroundColor: softColor }]}>
                        <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Completed</Text>
                        <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{dashboard.totalCompleted}</Text>
                        <Text style={[styles.metricHint, { color: colors.textSecondary }]}>last 30 days</Text>
                    </View>
                    <View style={[styles.metricCard, { backgroundColor: softColor }]}>
                        <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Remaining Load</Text>
                        <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{dashboard.remaining}</Text>
                        <Text style={[styles.metricHint, { color: colors.textSecondary }]}>scheduled actions</Text>
                    </View>
                    <View style={[styles.metricCard, { backgroundColor: softColor }]}>
                        <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Avg / Day</Text>
                        <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{dashboard.averageDailyCompletions}</Text>
                        <Text style={[styles.metricHint, { color: colors.textSecondary }]}>completed actions</Text>
                    </View>
                    <View style={[styles.metricCard, { backgroundColor: softColor }]}>
                        <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Required Pace</Text>
                        <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{dashboard.requiredDailyPace}</Text>
                        <Text style={[styles.metricHint, { color: colors.textSecondary }]}>per day to close gap</Text>
                    </View>
                </View>
            </VoidCard>

            <VoidCard glass style={[styles.chartCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={[styles.cardEyebrow, { color: colors.textTertiary }]}>Momentum Curve</Text>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>30-day execution flow</Text>
                    </View>
                    <View style={[styles.tooltipPill, { backgroundColor: softColor }]}>
                        <Text style={[styles.tooltipPillText, { color: colors.textSecondary }]}>
                            {selectedPoint ? `${selectedPoint.label}  ${selectedPoint.completed}/${selectedPoint.expected}` : 'Drag to inspect'}
                        </Text>
                    </View>
                </View>

                <GestureDetector gesture={chartGesture}>
                    <View style={styles.chartWrap}>
                        <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 24}>
                            <Defs>
                                <SvgGradient id="goalAreaFill" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={accentColor} stopOpacity="0.36" />
                                    <Stop offset="1" stopColor={accentColor} stopOpacity="0.02" />
                                </SvgGradient>
                            </Defs>

                            {[0.25, 0.5, 0.75, 1].map((level) => (
                                <Line
                                    key={level}
                                    x1="0"
                                    y1={CHART_HEIGHT - level * (CHART_HEIGHT - 28)}
                                    x2={CHART_WIDTH}
                                    y2={CHART_HEIGHT - level * (CHART_HEIGHT - 28)}
                                    stroke={gridColor}
                                    strokeWidth="1"
                                />
                            ))}

                            {fillPath ? <Path d={fillPath} fill="url(#goalAreaFill)" /> : null}
                            {linePath ? <Path d={linePath} stroke={accentColor} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

                            {chartPoints.map((point, index) => (
                                <Circle
                                    key={point.date}
                                    cx={point.x}
                                    cy={point.y}
                                    r={selectedPointIndex === index ? 5 : 0}
                                    fill={accentColor}
                                />
                            ))}

                            {selectedPoint ? (
                                <>
                                    <Line x1={selectedPoint.x} y1="0" x2={selectedPoint.x} y2={CHART_HEIGHT} stroke={accentColor} strokeWidth="1.5" strokeDasharray="5 5" />
                                    <Circle cx={selectedPoint.x} cy={selectedPoint.y} r="7" fill={colors.background} stroke={accentColor} strokeWidth="3" />
                                </>
                            ) : null}

                            {chartPoints.map((point, index) => {
                                if (index !== 0 && index !== Math.floor(chartPoints.length / 2) && index !== chartPoints.length - 1) {
                                    return null;
                                }

                                return (
                                    <SvgText
                                        key={`${point.date}-label`}
                                        x={point.x}
                                        y={CHART_HEIGHT + 18}
                                        fill={colors.textTertiary}
                                        fontSize="11"
                                        textAnchor="middle"
                                        fontFamily="Lexend_400Regular"
                                    >
                                        {point.label}
                                    </SvgText>
                                );
                            })}
                        </Svg>
                    </View>
                </GestureDetector>

                <View style={styles.signalRow}>
                    <View style={[styles.signalCard, { backgroundColor: softColor }]}>
                        <Text style={[styles.signalLabel, { color: colors.textTertiary }]}>Today</Text>
                        <Text style={[styles.signalValue, { color: colors.textPrimary }]}>{dashboard.completedToday}</Text>
                        <Text style={[styles.signalHint, { color: colors.textSecondary }]}>habits closed</Text>
                    </View>
                    <View style={[styles.signalCard, { backgroundColor: softColor }]}>
                        <Text style={[styles.signalLabel, { color: colors.textTertiary }]}>Best Session</Text>
                        <Text style={[styles.signalValue, { color: colors.textPrimary }]}>{dashboard.bestDay?.completed || 0}</Text>
                        <Text style={[styles.signalHint, { color: colors.textSecondary }]}>{dashboard.bestDay?.label || 'no data'}</Text>
                    </View>
                </View>
            </VoidCard>

            <VoidCard glass style={[styles.chartCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={[styles.cardEyebrow, { color: colors.textTertiary }]}>Weekly Tape</Text>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>8-week completion pressure</Text>
                    </View>
                </View>

                <View style={styles.weeklyWrap}>
                    <Svg width={WEEKLY_WIDTH} height={WEEKLY_HEIGHT + 28}>
                        {dashboard.weeklySeries.map((week, index) => {
                            const columnWidth = 28;
                            const gap = 12;
                            const x = index * (columnWidth + gap);
                            const barHeight = (week.ratio || 0) * (WEEKLY_HEIGHT - 24);
                            const y = WEEKLY_HEIGHT - barHeight;

                            return (
                                <React.Fragment key={week.label}>
                                    <Rect x={x} y={0} width={columnWidth} height={WEEKLY_HEIGHT} rx={14} fill={softColor} />
                                    <Rect x={x} y={y} width={columnWidth} height={Math.max(12, barHeight)} rx={14} fill={accentColor} />
                                    <SvgText
                                        x={x + columnWidth / 2}
                                        y={WEEKLY_HEIGHT + 18}
                                        fill={colors.textTertiary}
                                        fontSize="10"
                                        textAnchor="middle"
                                        fontFamily="Lexend_400Regular"
                                    >
                                        {index + 1}
                                    </SvgText>
                                </React.Fragment>
                            );
                        })}
                    </Svg>
                </View>

                <Text style={[styles.weeklyHint, { color: colors.textSecondary }]}>
                    Week 8 is the most recent. Taller bars mean stronger adherence against planned work.
                </Text>
            </VoidCard>

            <VoidCard glass style={[styles.chartCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={[styles.cardEyebrow, { color: colors.textTertiary }]}>Habit Drivers</Text>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>What is carrying the goal</Text>
                    </View>
                </View>

                <View style={styles.breakdownList}>
                    {dashboard.breakdown.map((habit) => {
                        const fillWidth = `${Math.max(8, habit.completionRate)}%` as `${number}%`;
                        return (
                            <View key={habit.id} style={[styles.breakdownRow, { borderBottomColor: gridColor }]}>
                                <View style={styles.breakdownTop}>
                                    <View style={styles.breakdownTitleWrap}>
                                        <View style={[styles.breakdownDot, { backgroundColor: habit.color }]} />
                                        <Text style={[styles.breakdownTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                                            {habit.name}
                                        </Text>
                                    </View>
                                    <Text style={[styles.breakdownPct, { color: colors.textPrimary }]}>{habit.completionRate}%</Text>
                                </View>
                                <View style={[styles.breakdownTrack, { backgroundColor: softColor }]}>
                                    <View style={[styles.breakdownFill, { width: fillWidth, backgroundColor: habit.color }]} />
                                </View>
                                <View style={styles.breakdownMeta}>
                                    <Text style={[styles.breakdownMetaText, { color: colors.textSecondary }]}>
                                        {habit.currentStreak} day streak
                                    </Text>
                                    <Text style={[styles.breakdownMetaText, { color: colors.textSecondary }]}>
                                        best {habit.bestStreak}
                                    </Text>
                                    <Text style={[styles.breakdownMetaText, { color: colors.textSecondary }]}>
                                        {habit.expected} scheduled
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </VoidCard>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionEyebrow: {
        fontSize: 10,
        letterSpacing: 1.8,
        fontFamily: 'Lexend_500Medium',
    },
    sectionTitle: {
        marginTop: 6,
        fontSize: 24,
        lineHeight: 28,
        fontFamily: 'Lexend_700Bold',
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
    },
    liveBadgeText: {
        fontSize: 12,
        fontFamily: 'Lexend_500Medium',
    },
    heroCard: {
        padding: 18,
        borderRadius: 28,
    },
    heroTop: {
        flexDirection: 'row',
        gap: 16,
    },
    heroLabel: {
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_500Medium',
    },
    heroValue: {
        marginTop: 6,
        fontSize: 44,
        lineHeight: 48,
        fontFamily: 'Lexend_700Bold',
    },
    heroHint: {
        marginTop: 10,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: 'Lexend_400Regular',
    },
    heroDialWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 120,
    },
    heroDialLabel: {
        marginTop: 8,
        fontSize: 11,
        fontFamily: 'Lexend_500Medium',
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 18,
    },
    metricCard: {
        width: (width - 96) / 2,
        borderRadius: 20,
        padding: 14,
    },
    metricLabel: {
        fontSize: 10,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_500Medium',
    },
    metricValue: {
        marginTop: 8,
        fontSize: 26,
        lineHeight: 30,
        fontFamily: 'Lexend_700Bold',
    },
    metricHint: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 16,
        fontFamily: 'Lexend_400Regular',
    },
    chartCard: {
        padding: 18,
        borderRadius: 28,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
    },
    cardEyebrow: {
        fontSize: 10,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_500Medium',
    },
    cardTitle: {
        marginTop: 6,
        fontSize: 18,
        lineHeight: 22,
        fontFamily: 'Lexend_600SemiBold',
    },
    tooltipPill: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        maxWidth: 148,
    },
    tooltipPillText: {
        fontSize: 11,
        lineHeight: 14,
        textAlign: 'right',
        fontFamily: 'Lexend_500Medium',
    },
    chartWrap: {
        marginTop: 18,
        alignItems: 'center',
    },
    signalRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
    },
    signalCard: {
        flex: 1,
        borderRadius: 18,
        padding: 14,
    },
    signalLabel: {
        fontSize: 10,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_500Medium',
    },
    signalValue: {
        marginTop: 8,
        fontSize: 24,
        lineHeight: 28,
        fontFamily: 'Lexend_700Bold',
    },
    signalHint: {
        marginTop: 6,
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
    weeklyWrap: {
        marginTop: 18,
        alignItems: 'center',
    },
    weeklyHint: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Lexend_400Regular',
    },
    breakdownList: {
        marginTop: 14,
    },
    breakdownRow: {
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    breakdownTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    breakdownTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    breakdownDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    breakdownTitle: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Lexend_500Medium',
    },
    breakdownPct: {
        fontSize: 16,
        fontFamily: 'Lexend_700Bold',
    },
    breakdownTrack: {
        height: 10,
        borderRadius: 999,
        overflow: 'hidden',
        marginTop: 12,
    },
    breakdownFill: {
        height: '100%',
        borderRadius: 999,
    },
    breakdownMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 10,
    },
    breakdownMetaText: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
    },
});
