import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Svg, Path, Polygon, Line, Circle, Text as SvgText, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, withDelay, Easing, withSpring } from 'react-native-reanimated';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Habit } from '@/lib/habits';
import { VoidCard } from '../Layout/VoidCard';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';

const { width } = Dimensions.get('window');

// ----------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------
const CHART_SIZE = width - 80;
const CENTER = CHART_SIZE / 2;
const RADIUS = CHART_SIZE / 2.5;

// 6 Pillars of Life Balance
const CATEGORIES = [
    { key: 'body', label: 'BODY', fullName: 'Physical Health', color: '#EF4444', icon: 'fitness' },
    { key: 'wealth', label: 'WEALTH', fullName: 'Career & Finances', color: '#F59E0B', icon: 'briefcase' },
    { key: 'heart', label: 'HEART', fullName: 'Relationships', color: '#EC4899', icon: 'heart' },
    { key: 'mind', label: 'MIND', fullName: 'Intellectual Growth', color: '#3B82F6', icon: 'bulb' },
    { key: 'soul', label: 'SOUL', fullName: 'Emotional & Spiritual', color: '#8B5CF6', icon: 'sparkles' },
    { key: 'play', label: 'PLAY', fullName: 'Recreation', color: '#10B981', icon: 'game-controller' },
];

interface AnalyticProps {
    habits: Habit[];
    completions: Record<string, boolean>; // Todays completions
    history: { date: string; completedIds: string[] }[];
}

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const AnalyticsDashboard: React.FC<AnalyticProps> = ({ habits, completions, history }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { selectionFeedback } = useHaptics();
    const { colors: accentColors, primary } = useAccentGradient();

    const [chartPeriod, setChartPeriod] = useState<'today' | '30d'>('today');

    // ------------------------------------------------------------------
    // 1. CALCULATE RADAR DATA
    // ------------------------------------------------------------------
    const radarData = useMemo(() => {
        return CATEGORIES.map(cat => {
            const catHabits = habits.filter(h => h.category === cat.key);
            if (catHabits.length === 0) return { ...cat, value: 0.2 };

            let score = 0;

            if (chartPeriod === 'today') {
                // Option 1: Daily Completion Rate
                const total = catHabits.length;
                const completed = catHabits.filter(h => completions[h.id]).length;
                score = total > 0 ? (completed / total) : 0;
            } else {
                // Option 3: Consistency (Last 30 Days)
                // We use the last 30 entries from history. 
                // Assuming history is sorted, we might need to sort it or assume it is.
                // In home.tsx it is sorted desc (b.date.localeCompare(a.date)) for streak, but historyData itself is from `getLastNDays` which usually returns desc or asc.
                // Re-sorting to be safe: newest first.
                const sortedHistory = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

                const daysCount = sortedHistory.length || 1;
                let totalCompletions = 0;

                sortedHistory.forEach(day => {
                    day.completedIds.forEach(id => {
                        if (catHabits.some(h => h.id === id)) {
                            totalCompletions++;
                        }
                    });
                });

                const maxPossible = daysCount * catHabits.length;
                score = maxPossible > 0 ? (totalCompletions / maxPossible) : 0;
            }

            const value = 0.3 + (score * 0.7);
            return { ...cat, value };
        });
    }, [habits, completions, history, chartPeriod]);

    // ------------------------------------------------------------------
    // 2. RADAR CHART HELPERS
    // ------------------------------------------------------------------
    const angleSlice = (Math.PI * 2) / CATEGORIES.length;

    const getCoordinates = (value: number, index: number) => {
        const angle = index * angleSlice - Math.PI / 2;
        const x = CENTER + Math.cos(angle) * (RADIUS * value);
        const y = CENTER + Math.sin(angle) * (RADIUS * value);
        return { x, y };
    };

    const radarPoints = radarData.map((d, i) => {
        const { x, y } = getCoordinates(d.value, i);
        return `${x},${y}`;
    }).join(' ');

    const radarNativePoints = radarData.map((d, i) => getCoordinates(d.value, i));

    const levels = [0.25, 0.5, 0.75, 1];

    // ------------------------------------------------------------------
    // 3. STATS CARDS
    // ------------------------------------------------------------------
    const totalHabits = habits.length;
    const completedHabits = Object.values(completions).filter(Boolean).length;
    const dayProgress = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;

    // Theme-specific colors
    const gridLineColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    const gridFillColor = isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)';
    const labelColor = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

    return (
        <View style={styles.container}>
            {/* Life Balance Matrix Card */}
            <VoidCard glass style={[styles.chartCard, isLight && { backgroundColor: colors.surfaceSecondary }]} intensity={isLight ? 20 : 90}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12, paddingHorizontal: 8, alignItems: 'center' }}>
                    <Text style={[styles.cardTitle, { color: colors.textSecondary, marginBottom: 0 }]}>LIFE MATRIX</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 2 }}>
                        <TouchableOpacity
                            style={[styles.periodBtn, chartPeriod === 'today' && { backgroundColor: isLight ? '#fff' : colors.surface, shadowOpacity: 0.1 }]}
                            onPress={() => { selectionFeedback(); setChartPeriod('today'); }}
                        >
                            <Text style={[styles.periodBtnText, { color: chartPeriod === 'today' ? colors.textPrimary : colors.textTertiary }]}>Today</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.periodBtn, chartPeriod === '30d' && { backgroundColor: isLight ? '#fff' : colors.surface, shadowOpacity: 0.1 }]}
                            onPress={() => { selectionFeedback(); setChartPeriod('30d'); }}
                        >
                            <Text style={[styles.periodBtnText, { color: chartPeriod === '30d' ? colors.textPrimary : colors.textTertiary }]}>30D</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={{ alignItems: 'center', justifyContent: 'center', height: CHART_SIZE }}>
                    <Svg width={CHART_SIZE} height={CHART_SIZE}>
                        <Defs>
                            <LinearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor={accentColors[0]} stopOpacity="0.8" />
                                <Stop offset="1" stopColor={accentColors[1]} stopOpacity="0.6" />
                            </LinearGradient>
                        </Defs>

                        {/* Background Webs */}
                        {levels.map((level, i) => {
                            const pts = CATEGORIES.map((_, idx) => {
                                const { x, y } = getCoordinates(level, idx);
                                return `${x},${y}`;
                            }).join(' ');
                            return (
                                <Polygon
                                    key={i}
                                    points={pts}
                                    stroke={gridLineColor}
                                    strokeWidth="1"
                                    fill={i === levels.length - 1 ? gridFillColor : "none"}
                                />
                            );
                        })}

                        {/* Axis Lines */}
                        {CATEGORIES.map((_, i) => {
                            const { x, y } = getCoordinates(1, i);
                            return (
                                <Line
                                    key={`line-${i}`}
                                    x1={CENTER}
                                    y1={CENTER}
                                    x2={x}
                                    y2={y}
                                    stroke={gridLineColor}
                                    strokeWidth="1"
                                />
                            );
                        })}

                        {/* Labels */}
                        {CATEGORIES.map((cat, i) => {
                            const { x, y } = getCoordinates(1.15, i);
                            return (
                                <SvgText
                                    key={`label-${i}`}
                                    x={x}
                                    y={y}
                                    fill={labelColor}
                                    fontSize="9"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    alignmentBaseline="middle"
                                    letterSpacing="1"
                                >
                                    {cat.label}
                                </SvgText>
                            );
                        })}

                        {/* The Actual Radar Shape */}
                        <AnimatedPolygon
                            points={radarPoints}
                            fill="url(#radarGrad)"
                            fillOpacity="0.4"
                            stroke={primary}
                            strokeWidth="2"
                        />

                        {/* Data Points */}
                        {radarNativePoints.map((p, i) => (
                            <Circle
                                key={`point-${i}`}
                                cx={p.x}
                                cy={p.y}
                                r="3"
                                fill={isLight ? colors.background : '#fff'}
                                stroke={primary}
                                strokeWidth="2"
                            />
                        ))}
                    </Svg>
                </View>
            </VoidCard>

            {/* Today's Completion Card */}
            <VoidCard glass style={[styles.completionCard, isLight && { backgroundColor: colors.surfaceSecondary }]} intensity={isLight ? 20 : 90}>
                <View style={styles.completionRow}>
                    <View style={styles.completionLeft}>
                        <ExpoLinearGradient colors={accentColors} style={styles.completionIcon}>
                            <Ionicons name="pie-chart" size={20} color="#fff" />
                        </ExpoLinearGradient>
                        <View>
                            <Text style={[styles.completionLabel, { color: colors.textSecondary }]}>TODAY'S COMPLETION</Text>
                            <Text style={[styles.completionSubtext, { color: colors.textPrimary }]}>{completedHabits}/{totalHabits} habits done</Text>
                        </View>
                    </View>
                    <Text style={[styles.completionValue, { color: colors.textPrimary }]}>{dayProgress}%</Text>
                </View>
            </VoidCard>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        // marginBottom: 16, // Removed to avoid double margin with Home screen
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
        fontFamily: 'Lexend',
    },
    subtitle: {
        fontSize: 9,
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    toggleBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    chartCard: {
        padding: 12,
        alignItems: 'center',
    },
    statsContainer: {
        width: '100%',
        padding: 4,
    },
    bigStat: {
        alignItems: 'center',
        marginBottom: 16,
    },
    bigStatIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    bigStatValue: {
        fontSize: 32,
        fontWeight: '900',
        fontFamily: 'Lexend',
    },
    bigStatLabel: {
        fontSize: 10,
        letterSpacing: 2,
        fontFamily: 'Lexend_400Regular',
    },
    gridStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    gridItem: {
        flex: 1,
        minWidth: '40%',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
    },
    gridVal: {
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Lexend',
        marginBottom: 2,
    },
    gridLbl: {
        fontSize: 8,
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    cardTitle: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 2,
        fontFamily: 'Lexend',
        marginBottom: 8,
        textAlign: 'center',
    },
    completionCard: {
        marginTop: 16,
        padding: 16,
    },
    completionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    completionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    completionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    completionLabel: {
        fontSize: 10,
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    completionSubtext: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    completionValue: {
        fontSize: 28,
        fontWeight: '900',
        fontFamily: 'Lexend',
    },
    periodBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    periodBtnText: {
        fontSize: 10,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
});
