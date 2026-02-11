
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { Habit, calculateGoalProgress, getCompletions } from '@/lib/habitsSQLite';
import Svg, { Circle, G, Path, Rect, Defs, LinearGradient as SvgGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { VoidCard } from '@/components/Layout/VoidCard';
import Animated, { useSharedValue, useAnimatedProps, withTiming, withDelay, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useHaptics } from '@/hooks/useHaptics';

const { width } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const GRAPH_HEIGHT = 180;
const GRAPH_WIDTH = width - 80; // Padding consideration

interface GoalStatsProps {
    goal: Habit;
    habits: Habit[];
}

export const GoalStats: React.FC<GoalStatsProps> = ({ goal, habits }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();

    // Data State
    const [stats, setStats] = useState({
        totalExpected: 1,
        totalCompleted: 0,
        remaining: 0,
        dailyActivity: [] as { date: string, count: number }[],
    });

    // Interaction State
    const activeIndex = useSharedValue(-1);
    const [tooltipData, setTooltipData] = useState<{ date: string, value: number } | null>(null);
    const [tooltipIndex, setTooltipIndex] = useState(-1);

    useEffect(() => {
        const loadStats = async () => {
            const startDate = new Date(goal.startDate || goal.createdAt);
            const targetDate = goal.targetDate ? new Date(goal.targetDate) : new Date();

            // 1. Calculate History for Graph (Last 14 Days)
            const days = [];
            const today = new Date();
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                days.push(d.toISOString().split('T')[0]);
            }

            const linked = habits.filter(h => h.goalId === goal.id);

            const activity = await Promise.all(days.map(async (date) => {
                const comps = await getCompletions(date);
                let count = 0;
                linked.forEach(h => { if (comps[h.id]) count++; });
                return { date, count };
            }));

            // 2. Calculate Progress Metrics
            const percentage = await calculateGoalProgress(goal);

            // Estimates (as per previous logic)
            const dayDiff = Math.max(1, Math.ceil((targetDate.getTime() - startDate.getTime()) / (86400000)));
            let totalPotential = 0;
            linked.forEach(h => {
                const frequency = h.taskDays.length / 7;
                totalPotential += Math.round(frequency * dayDiff);
            });
            const completedEst = Math.round(totalPotential * (percentage / 100));
            const remaining = Math.max(0, totalPotential - completedEst);

            setStats({
                totalExpected: totalPotential || 1, // Avoid NaN
                totalCompleted: completedEst,
                remaining: remaining,
                dailyActivity: activity
            });
        };
        loadStats();
    }, [goal, habits]);

    // Donut Animation
    const radius = 60;
    const strokeWidth = 12;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (stats.totalCompleted / stats.totalExpected) * circumference;

    const animatedDonutProps = useAnimatedProps(() => {
        return { strokeDashoffset: withDelay(500, withTiming(progressOffset, { duration: 1500 })) };
    });

    // Graph Calculations
    const maxVal = Math.max(Math.max(...stats.dailyActivity.map(d => d.count)), 2); // At least 2 for scale
    const stepX = GRAPH_WIDTH / 13; // 14 points = 13 segments

    // Construct Path
    const pathD = stats.dailyActivity.length > 0 ? (
        `M 0 ${GRAPH_HEIGHT} ` +
        stats.dailyActivity.map((d, i) => {
            const x = i * stepX;
            const y = GRAPH_HEIGHT - (d.count / maxVal) * GRAPH_HEIGHT;
            return `L ${x} ${y}`;
        }).join(' ') +
        ` L ${GRAPH_WIDTH} ${GRAPH_HEIGHT} Z` // Close area
    ) : "";

    const linePathD = stats.dailyActivity.length > 0 ? (
        `M 0 ${GRAPH_HEIGHT - (stats.dailyActivity[0].count / maxVal) * GRAPH_HEIGHT} ` +
        stats.dailyActivity.map((d, i) => {
            const x = i * stepX;
            const y = GRAPH_HEIGHT - (d.count / maxVal) * GRAPH_HEIGHT;
            return `L ${x} ${y}`;
        }).join(' ')
    ) : "";

    // Gestures
    const updateTooltip = useCallback((index: number) => {
        if (index >= 0 && index < stats.dailyActivity.length) {
            setTooltipData({
                date: new Date(stats.dailyActivity[index].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: stats.dailyActivity[index].count
            });
            setTooltipIndex(index);
            selectionFeedback();
        } else {
            setTooltipData(null);
            setTooltipIndex(-1);
        }
    }, [stats.dailyActivity]);

    const gesture = Gesture.Pan()
        .onBegin((e) => {
            const idx = Math.min(Math.max(Math.round(e.x / stepX), 0), 13);
            activeIndex.value = idx;
            runOnJS(updateTooltip)(idx);
        })
        .onUpdate((e) => {
            const idx = Math.min(Math.max(Math.round(e.x / stepX), 0), 13);
            if (activeIndex.value !== idx) {
                activeIndex.value = idx;
                runOnJS(updateTooltip)(idx);
            }
        })
        .onFinalize(() => {
            activeIndex.value = -1;
            runOnJS(setTooltipData)(null);
            runOnJS(setTooltipIndex)(-1);
        });

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>MISSION ANALYTICS</Text>

            {/* Top Row: Donut & Stats */}
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
                {/* Donut */}
                <VoidCard glass style={styles.donutCard}>
                    <Svg width={140} height={140} viewBox="0 0 140 140">
                        <G rotation="-90" origin="70, 70">
                            <Circle cx="70" cy="70" r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="transparent" />
                            <AnimatedCircle
                                cx="70" cy="70" r={radius}
                                stroke={goal.color || colors.primary}
                                strokeWidth={strokeWidth}
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeLinecap="round"
                                animatedProps={animatedDonutProps}
                            />
                        </G>
                        <View style={styles.donutText}>
                            <Text style={styles.percentText}>
                                {Math.round((stats.totalCompleted / stats.totalExpected) * 100)}%
                            </Text>
                            <Text style={styles.percentLabel}>COMPLETED</Text>
                        </View>
                    </Svg>
                </VoidCard>

                {/* Text Stats */}
                <View style={{ flex: 1, gap: 12 }}>
                    <VoidCard glass style={styles.statBox}>
                        <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.totalCompleted}</Text>
                        <Text style={styles.statLabel}>HABITS COMPLETED</Text>
                    </VoidCard>
                    <VoidCard glass style={styles.statBox}>
                        <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.remaining}</Text>
                        <Text style={styles.statLabel}>HABITS REMAINING</Text>
                    </VoidCard>
                </View>
            </View>

            {/* Interactive Graph */}
            <GestureDetector gesture={gesture}>
                <VoidCard glass style={styles.graphCard}>
                    <View style={styles.graphHeader}>
                        <Text style={styles.graphTitle}>ACTIVITY TRAJECTORY</Text>
                        {tooltipData ? (
                            <Text style={[styles.tooltipText, { color: goal.color }]}>
                                {tooltipData.value} on {tooltipData.date}
                            </Text>
                        ) : (
                            <Text style={styles.tooltipText}>Touch to inspect</Text>
                        )}
                    </View>

                    <View style={{ height: GRAPH_HEIGHT + 30, width: GRAPH_WIDTH }}>
                        <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT + 30}>
                            <Defs>
                                <SvgGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={goal.color || colors.primary} stopOpacity="0.4" />
                                    <Stop offset="1" stopColor={goal.color || colors.primary} stopOpacity="0" />
                                </SvgGradient>
                            </Defs>

                            {/* Axes Only (GridLines) */}
                            {[0, 0.5, 1].map(t => (
                                <Line
                                    key={t}
                                    x1="0" y1={GRAPH_HEIGHT * t}
                                    x2={GRAPH_WIDTH} y2={GRAPH_HEIGHT * t}
                                    stroke="rgba(255,255,255,0.05)"
                                    strokeWidth="1"
                                />
                            ))}

                            {/* Area */}
                            <Path d={pathD} fill="url(#gradient)" />

                            {/* Line */}
                            <Path d={linePathD} fill="none" stroke={goal.color || colors.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                            {/* X-Axis Labels */}
                            {stats.dailyActivity.map((d, i) => {
                                if (i % 3 !== 0) return null; // Only show every 3rd
                                const x = i * stepX;
                                return (
                                    <SvgText
                                        key={i}
                                        x={x}
                                        y={GRAPH_HEIGHT + 20}
                                        fill="rgba(255,255,255,0.4)"
                                        fontSize="10"
                                        textAnchor="middle"
                                        fontFamily="Lexend_400Regular"
                                    >
                                        {new Date(d.date).getDate()}
                                    </SvgText>
                                );
                            })}

                            {/* Active Cursor (Only when touching) */}
                            {tooltipData && tooltipIndex >= 0 && (
                                <Line
                                    x1={tooltipIndex * stepX}
                                    y1={0}
                                    x2={tooltipIndex * stepX}
                                    y2={GRAPH_HEIGHT}
                                    stroke="white"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                />
                            )}

                            {/* Active Dot */}
                            {tooltipData && tooltipIndex >= 0 && (
                                <Circle
                                    cx={tooltipIndex * stepX}
                                    cy={GRAPH_HEIGHT - (tooltipData.value / maxVal) * GRAPH_HEIGHT}
                                    r="6"
                                    fill="white"
                                    stroke={goal.color}
                                    strokeWidth="2"
                                />
                            )}

                        </Svg>
                    </View>
                </VoidCard>
            </GestureDetector>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginTop: 24 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginBottom: 16, fontFamily: 'Lexend_400Regular' },
    donutCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    donutText: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    percentText: { color: 'white', fontSize: 24, fontWeight: 'bold', fontFamily: 'Lexend' },
    percentLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    statBox: { flex: 1, padding: 12, justifyContent: 'center' },
    statValue: { fontSize: 24, fontWeight: 'bold', marginBottom: 4, fontFamily: 'Lexend' },
    statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, fontFamily: 'Lexend_400Regular' },
    graphCard: { padding: 20 },
    graphHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' },
    graphTitle: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 1, fontFamily: 'Lexend_400Regular' },
    tooltipText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular' }
});
