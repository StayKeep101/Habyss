import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Rect, Path, Defs, LinearGradient as SvgGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRAPH_WIDTH = SCREEN_WIDTH - 64;
const GRAPH_HEIGHT = 160;

interface DayData {
    date: string;
    completed: boolean;
    value?: number;
}

interface HabitGraphRendererProps {
    graphStyle: string;
    color: string;
    goalValue: number;
    unit: string;
    completionData: DayData[]; // Last N days of data
    currentStreak: number;
    todayValue?: number;
}

// ─── Progress Ring ───────────────────────────────────────────
function ProgressRing({ color, goalValue, unit, todayValue = 0 }: {
    color: string; goalValue: number; unit: string; todayValue: number;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const size = 140;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(todayValue / Math.max(goalValue, 1), 1);
    const offset = circumference * (1 - progress);

    return (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Svg width={size} height={size}>
                <Circle
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={color + '20'} strokeWidth={strokeWidth} fill="none"
                />
                <Circle
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={color} strokeWidth={strokeWidth} fill="none"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
                <SvgText
                    x={size / 2} y={size / 2 - 8}
                    textAnchor="middle" fill={colors.textPrimary}
                    fontSize={28} fontWeight="bold"
                >
                    {todayValue}
                </SvgText>
                <SvgText
                    x={size / 2} y={size / 2 + 16}
                    textAnchor="middle" fill={colors.textTertiary}
                    fontSize={12}
                >
                    / {goalValue} {unit}
                </SvgText>
            </Svg>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 8, fontFamily: 'Lexend_400Regular' }}>
                {Math.round(progress * 100)}% Complete Today
            </Text>
        </View>
    );
}

// ─── Bar Chart ───────────────────────────────────────────────
function BarChart({ color, completionData, goalValue }: {
    color: string; completionData: DayData[]; goalValue: number;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const data = completionData.slice(-7); // Last 7 days
    const barWidth = (GRAPH_WIDTH - 48) / 7;
    const maxVal = Math.max(goalValue, ...data.map(d => d.value || (d.completed ? 1 : 0)));

    return (
        <View style={{ paddingVertical: 8 }}>
            <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
                <Defs>
                    <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity="1" />
                        <Stop offset="1" stopColor={color} stopOpacity="0.5" />
                    </SvgGradient>
                </Defs>
                {data.map((day, i) => {
                    const val = day.value || (day.completed ? goalValue : 0);
                    const barH = maxVal > 0 ? (val / maxVal) * (GRAPH_HEIGHT - 30) : 0;
                    const x = i * barWidth + 24;
                    const y = GRAPH_HEIGHT - 20 - barH;
                    const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'narrow' });

                    return (
                        <G key={day.date}>
                            <Rect
                                x={x + 2} y={y} width={barWidth - 6} height={barH}
                                rx={4} fill={val > 0 ? 'url(#barGrad)' : color + '15'}
                            />
                            <SvgText
                                x={x + barWidth / 2} y={GRAPH_HEIGHT - 4}
                                textAnchor="middle" fill={colors.textTertiary}
                                fontSize={10}
                            >
                                {dayLabel}
                            </SvgText>
                        </G>
                    );
                })}
            </Svg>
        </View>
    );
}

// ─── Line Chart ──────────────────────────────────────────────
function LineChart({ color, completionData, goalValue }: {
    color: string; completionData: DayData[]; goalValue: number;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const data = completionData.slice(-14); // Last 14 days
    if (data.length < 2) return null;

    const chartPadding = 24;
    const chartW = GRAPH_WIDTH - chartPadding * 2;
    const chartH = GRAPH_HEIGHT - 30;
    const maxVal = Math.max(goalValue, ...data.map(d => d.value || (d.completed ? goalValue : 0)));

    const points = data.map((day, i) => {
        const val = day.value || (day.completed ? goalValue : 0);
        const x = chartPadding + (i / (data.length - 1)) * chartW;
        const y = chartH - (maxVal > 0 ? (val / maxVal) * (chartH - 10) : 0) + 5;
        return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const fillPath = `${linePath} L ${points[points.length - 1].x} ${chartH + 5} L ${points[0].x} ${chartH + 5} Z`;

    return (
        <View style={{ paddingVertical: 8 }}>
            <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
                <Defs>
                    <SvgGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity="0.3" />
                        <Stop offset="1" stopColor={color} stopOpacity="0.02" />
                    </SvgGradient>
                </Defs>
                <Path d={fillPath} fill="url(#lineGrad)" />
                <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p, i) => (
                    <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
                ))}
            </Svg>
        </View>
    );
}

// ─── Heatmap ─────────────────────────────────────────────────
function HeatmapChart({ color, completionData }: {
    color: string; completionData: DayData[];
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const data = completionData.slice(-35); // Last 5 weeks
    const cols = 7;
    const rows = Math.ceil(data.length / cols);
    const cellSize = Math.min((GRAPH_WIDTH - 16) / cols, 20);
    const gap = 3;

    return (
        <View style={{ paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap }}>
                {data.map((day, i) => {
                    const intensity = day.completed ? 1 : (day.value ? Math.min(day.value / 10, 1) : 0);
                    const opacity = intensity > 0 ? 0.2 + intensity * 0.8 : 0.06;

                    return (
                        <View
                            key={day.date}
                            style={{
                                width: cellSize, height: cellSize,
                                borderRadius: 4,
                                backgroundColor: intensity > 0 ? color : colors.textTertiary,
                                opacity,
                            }}
                        />
                    );
                })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 9, color: colors.textTertiary }}>Less</Text>
                {[0.1, 0.3, 0.6, 1].map((op, i) => (
                    <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, opacity: 0.2 + op * 0.8 }} />
                ))}
                <Text style={{ fontSize: 9, color: colors.textTertiary }}>More</Text>
            </View>
        </View>
    );
}

// ─── Streak Counter ──────────────────────────────────────────
function StreakCounter({ color, currentStreak }: {
    color: string; currentStreak: number;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Text style={{ fontSize: 56, fontWeight: '900', color, fontFamily: 'SpaceGrotesk_700Bold' }}>
                {currentStreak}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="flame" size={18} color="#F59E0B" />
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Lexend_500Medium', letterSpacing: 1 }}>
                    DAY STREAK
                </Text>
                <Ionicons name="flame" size={18} color="#F59E0B" />
            </View>
            <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 8, fontFamily: 'Lexend_400Regular' }}>
                {currentStreak === 0 ? 'Start your streak today!' :
                    currentStreak < 7 ? 'Keep going! 🌱' :
                        currentStreak < 30 ? 'Amazing consistency! 🔥' :
                            'Legendary streak! 🏆'}
            </Text>
        </View>
    );
}

// ─── Main Renderer ───────────────────────────────────────────
export const HabitGraphRenderer: React.FC<HabitGraphRendererProps> = ({
    graphStyle,
    color,
    goalValue,
    unit,
    completionData,
    currentStreak,
    todayValue = 0,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    const title = useMemo(() => {
        switch (graphStyle) {
            case 'progress': return 'Today\'s Progress';
            case 'bar': return 'Weekly Overview';
            case 'line': return '14-Day Trend';
            case 'heatmap': return 'Activity Map';
            case 'streak': return 'Current Streak';
            default: return 'Weekly Overview';
        }
    }, [graphStyle]);

    const renderGraph = () => {
        switch (graphStyle) {
            case 'progress':
                return <ProgressRing color={color} goalValue={goalValue} unit={unit} todayValue={todayValue} />;
            case 'bar':
                return <BarChart color={color} completionData={completionData} goalValue={goalValue} />;
            case 'line':
                return <LineChart color={color} completionData={completionData} goalValue={goalValue} />;
            case 'heatmap':
                return <HeatmapChart color={color} completionData={completionData} />;
            case 'streak':
                return <StreakCounter color={color} currentStreak={currentStreak} />;
            default:
                return <BarChart color={color} completionData={completionData} goalValue={goalValue} />;
        }
    };

    return (
        <VoidCard glass intensity={30} style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                </View>
            </View>
            {renderGraph()}
        </VoidCard>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Lexend_500Medium',
        letterSpacing: 0.3,
    },
});
