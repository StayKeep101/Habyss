import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Svg, Path, Polygon, Line, Circle, Text as SvgText, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, withDelay, Easing, withSpring } from 'react-native-reanimated';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Habit } from '@/lib/habits';
import { VoidCard } from '../Layout/VoidCard';
import { BlurView } from 'expo-blur';

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
}

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const AnalyticsDashboard: React.FC<AnalyticProps> = ({ habits, completions }) => {
    const [viewMode, setViewMode] = useState<'radar' | 'stats'>('radar');

    // ------------------------------------------------------------------
    // 1. CALCULATE RADAR DATA
    // ------------------------------------------------------------------
    const radarData = useMemo(() => {
        // Mocking some "Level" data based on habits count and completions
        // In reality, this would likely aggregatre historical data
        return CATEGORIES.map(cat => {
            const catHabits = habits.filter(h => h.category === cat.key);
            if (catHabits.length === 0) return { ...cat, value: 0.2 }; // Base value

            const total = catHabits.length;
            const completed = catHabits.filter(h => completions[h.id]).length;

            // Normalize: 0.2 (base) + (0.8 * completionRate)
            // Or just simplified "Habit Score"
            const score = total > 0 ? (completed / total) : 0;
            const value = 0.3 + (score * 0.7);
            return { ...cat, value };
        });
    }, [habits, completions]);

    // ------------------------------------------------------------------
    // 2. RADAR CHART HELPERS
    // ------------------------------------------------------------------
    const angleSlice = (Math.PI * 2) / CATEGORIES.length;

    // Helper to get coordinates
    const getCoordinates = (value: number, index: number) => {
        const angle = index * angleSlice - Math.PI / 2; // Start from top
        const x = CENTER + Math.cos(angle) * (RADIUS * value);
        const y = CENTER + Math.sin(angle) * (RADIUS * value);
        return { x, y };
    };

    const radarPoints = radarData.map((d, i) => {
        const { x, y } = getCoordinates(d.value, i);
        return `${x},${y}`;
    }).join(' ');

    const radarNativePoints = radarData.map((d, i) => getCoordinates(d.value, i));

    // Background Web Grid (Concentric Levels)
    const levels = [0.25, 0.5, 0.75, 1];

    // ------------------------------------------------------------------
    // 3. STATS CARDS
    // ------------------------------------------------------------------
    const totalHabits = habits.length;
    const completedHabits = Object.values(completions).filter(Boolean).length;
    const dayProgress = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;

    return (
        <View style={styles.container}>
            {/* Life Balance Matrix Card */}
            <VoidCard glass style={styles.chartCard} intensity={90}>
                <Text style={styles.cardTitle}>LIFE BALANCE MATRIX</Text>
                <View style={{ alignItems: 'center', justifyContent: 'center', height: CHART_SIZE }}>
                    <Svg width={CHART_SIZE} height={CHART_SIZE}>
                        <Defs>
                            <LinearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor="#3B82F6" stopOpacity="0.8" />
                                <Stop offset="1" stopColor="#EC4899" stopOpacity="0.6" />
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
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="1"
                                    fill={i === levels.length - 1 ? "rgba(255,255,255,0.02)" : "none"}
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
                                    stroke="rgba(255,255,255,0.1)"
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
                                    fill="rgba(255,255,255,0.6)"
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
                            stroke="#8B5CF6"
                            strokeWidth="2"
                        />

                        {/* Data Points */}
                        {radarNativePoints.map((p, i) => (
                            <Circle
                                key={`point-${i}`}
                                cx={p.x}
                                cy={p.y}
                                r="3"
                                fill="#fff"
                                stroke="#8B5CF6"
                                strokeWidth="2"
                            />
                        ))}
                    </Svg>
                </View>
            </VoidCard>

            {/* Today's Completion Card */}
            <VoidCard glass style={styles.completionCard} intensity={90}>
                <View style={styles.completionRow}>
                    <View style={styles.completionLeft}>
                        <ExpoLinearGradient colors={['#3B82F6', '#8B5CF6']} style={styles.completionIcon}>
                            <Ionicons name="pie-chart" size={20} color="#fff" />
                        </ExpoLinearGradient>
                        <View>
                            <Text style={styles.completionLabel}>TODAY'S COMPLETION</Text>
                            <Text style={styles.completionSubtext}>{completedHabits}/{totalHabits} habits done</Text>
                        </View>
                    </View>
                    <Text style={styles.completionValue}>{dayProgress}%</Text>
                </View>
            </VoidCard>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
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
        color: '#fff',
        letterSpacing: 2,
        fontFamily: 'Lexend',
    },
    subtitle: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    toggleBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
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
        color: '#fff',
        fontFamily: 'Lexend',
    },
    bigStatLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
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
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    gridVal: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        fontFamily: 'Lexend',
        marginBottom: 2,
    },
    gridLbl: {
        fontSize: 8,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    cardTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 2,
        fontFamily: 'Lexend',
        marginBottom: 8,
        textAlign: 'center',
    },
    completionCard: {
        marginTop: 12,
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
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    completionSubtext: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '500',
        marginTop: 2,
    },
    completionValue: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'Lexend',
    },
});
