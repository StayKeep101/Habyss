import { FontFamily } from '@/theme/designSystem';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Rect, Path, Line, Defs, LinearGradient as SvgGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { VoidCard } from '@/components/ui/VoidCard';
import { useAnimatedProps } from 'react-native-reanimated';
import { AnimatedCircle, CountUp, GrowBar, MOTION, PopIn, Reveal, useCountUp, useProgress } from '@/components/ui/Motion';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRAPH_WIDTH = SCREEN_WIDTH - 64;
const GRAPH_HEIGHT = 160;

interface DayData {
    date: string;
    completed: boolean;
    value?: number;
    /** Deliberately skipped — not a failure, and not a zero. */
    skipped?: boolean;
    /** Whether the schedule asked for the habit at all. Absent means it did. */
    scheduled?: boolean;
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

/**
 * What a single day is actually worth.
 *
 * The distinction these charts were missing: a day the habit was never due is
 * not a day you scored zero on. Plotting it as zero is the oldest mistake in
 * charting — treating absent data as the value nought — and on a three-times-a-
 * week habit it drew four crashes into every week that never happened.
 */
type State = 'kept' | 'missed' | 'skipped' | 'off';
interface Point { date: string; state: State; value: number }

const prepare = (data: DayData[], goalValue: number): Point[] => data.map(day => {
    // An older caller that knows nothing about scheduling means every day counted.
    const due = day.scheduled !== false;
    const state: State = day.completed ? 'kept' : day.skipped ? 'skipped' : due ? 'missed' : 'off';
    return { date: day.date, state, value: state === 'kept' ? (day.value || goalValue) : (day.value ?? 0) };
});

/** Only the days that actually asked something of you set the scale. */
const ceilingOf = (points: Point[], goalValue: number) =>
    Math.max(goalValue, ...points.filter(p => p.state !== 'off').map(p => p.value), 1);

const weekday = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });

/** The target, drawn so a value can be read against something. */
const GoalLine = ({ y, width, color, label }: { y: number; width: number; color: string; label: string }) => (
    <G>
        <Line x1={8} y1={y} x2={width - 8} y2={y} stroke={color} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
        <SvgText x={width - 8} y={y - 4} textAnchor="end" fill={color} fontSize={9} fontFamily={FontFamily.medium} opacity={0.85}>
            {label}
        </SvgText>
    </G>
);

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
    const shown = useProgress(progress);
    const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.get()) }));
    const counted = useCountUp(todayValue);

    return (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Svg width={size} height={size}>
                <Circle
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={color + '20'} strokeWidth={strokeWidth} fill="none"
                />
                <AnimatedCircle
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={color} strokeWidth={strokeWidth} fill="none"
                    strokeDasharray={circumference} animatedProps={arc}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
                <SvgText
                    x={size / 2} y={size / 2 - 8}
                    textAnchor="middle" fill={colors.textPrimary}
                    fontSize={28} fontFamily={FontFamily.bold}
                >
                    {counted}
                </SvgText>
                <SvgText
                    x={size / 2} y={size / 2 + 16}
                    textAnchor="middle" fill={colors.textTertiary}
                    fontSize={12} fontFamily={FontFamily.regular}
                >
                    / {goalValue} {unit}
                </SvgText>
            </Svg>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 8, fontFamily: FontFamily.regular }}>
                <CountUp value={`${Math.round(progress * 100)}%`} /> Complete Today
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
    const isLight = theme === 'light';
    // SVG defs are document-global, so two charts on one screen would otherwise
    // share — and fight over — the same gradient.
    const gid = `bar${React.useId().replace(/:/g, '')}`;

    const points = prepare(completionData, goalValue).slice(-7);
    const barWidth = (GRAPH_WIDTH - 48) / 7;
    const track = isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.045)';
    // A missed day is a real answer, so it gets a mark rather than a smudge of
    // the accent you can barely see.
    const missed = isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.13)';
    const ceiling = ceilingOf(points, goalValue);
    const floor = GRAPH_HEIGHT - 20;
    const span = GRAPH_HEIGHT - 30;
    const goalY = floor - (goalValue / ceiling) * span;

    return (
        <View style={{ paddingVertical: 8 }}>
            <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
                <Defs>
                    <SvgGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity="1" />
                        <Stop offset="1" stopColor={color} stopOpacity="0.5" />
                    </SvgGradient>
                </Defs>

                {goalValue > 0 && goalY > 8 ? (
                    <GoalLine y={goalY} width={GRAPH_WIDTH} color={colors.textTertiary} label={`goal ${goalValue}`} />
                ) : null}

                {points.map((point, index) => {
                    const x = index * barWidth + 24;
                    const height = point.state === 'off' ? 0 : (point.value / ceiling) * span;

                    return (
                        <G key={point.date}>
                            {/* The slot the day could have filled. Without it a
                                week of missed days is seven two-pixel slivers
                                and the card reads as broken rather than empty. */}
                            <Rect
                                x={x + 2} y={floor - span} width={barWidth - 6} height={span} rx={6}
                                fill={track}
                            />
                            {point.state === 'off' ? (
                                // Not due: the track alone, so the week keeps
                                // its shape without claiming you scored nothing.
                                <Rect
                                    x={x + 2} y={floor - 4} width={barWidth - 6} height={4} rx={2}
                                    fill={colors.textTertiary} opacity={0.35}
                                />
                            ) : (
                                <GrowBar
                                    x={x + 2} floor={floor} width={barWidth - 6} height={Math.max(height, 4)} rx={6}
                                    fill={point.state === 'kept' ? `url(#${gid})`
                                        : point.state === 'skipped' ? colors.textTertiary
                                            : missed}
                                    opacity={point.state === 'skipped' ? 0.5 : 1}
                                    delay={index * MOTION.stagger}
                                />
                            )}
                            <SvgText
                                x={x + barWidth / 2} y={GRAPH_HEIGHT - 4}
                                textAnchor="middle" fill={colors.textTertiary}
                                fontSize={10} fontFamily={FontFamily.regular}
                                opacity={point.state === 'off' ? 0.45 : 1}
                            >
                                {weekday(point.date)}
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
    const gid = `line${React.useId().replace(/:/g, '')}`;

    const points = prepare(completionData, goalValue).slice(-14);
    const chartPadding = 24;
    const chartW = GRAPH_WIDTH - chartPadding * 2;
    const chartH = GRAPH_HEIGHT - 30;
    const ceiling = ceilingOf(points, goalValue);

    const placed = points.map((point, index) => ({
        ...point,
        x: chartPadding + (points.length === 1 ? chartW / 2 : (index / (points.length - 1)) * chartW),
        y: chartH - (point.value / ceiling) * (chartH - 10) + 5,
    }));

    // The line breaks over days the habit was never due, rather than diving to
    // the floor and inventing a slump that did not happen.
    const segments = useMemo(() => {
        const runs: (typeof placed)[] = [];
        let run: typeof placed = [];
        for (const point of placed) {
            if (point.state === 'off') { if (run.length) runs.push(run); run = []; }
            else run.push(point);
        }
        if (run.length) runs.push(run);
        return runs;
    }, [placed]);

    if (!segments.some(run => run.length >= 2)) return null;
    const goalY = chartH - (goalValue / ceiling) * (chartH - 10) + 5;

    return (
        <View style={{ paddingVertical: 8 }}>
            <Reveal>
            <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
                <Defs>
                    <SvgGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity="0.3" />
                        <Stop offset="1" stopColor={color} stopOpacity="0.02" />
                    </SvgGradient>
                </Defs>

                {goalValue > 0 && goalY > 8 ? (
                    <GoalLine y={goalY} width={GRAPH_WIDTH} color={colors.textTertiary} label={`goal ${goalValue}`} />
                ) : null}

                {segments.map((run, index) => {
                    if (run.length < 2) return null;
                    const line = run.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const fill = `${line} L ${run[run.length - 1].x} ${chartH + 5} L ${run[0].x} ${chartH + 5} Z`;
                    return (
                        <G key={index}>
                            <Path d={fill} fill={`url(#${gid})`} />
                            <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </G>
                    );
                })}

                {segments.flat().map(point => (
                    <Circle
                        key={point.date}
                        cx={point.x} cy={point.y} r={point.state === 'skipped' ? 2.5 : 3}
                        fill={point.state === 'skipped' ? colors.textTertiary : color}
                        opacity={point.state === 'missed' ? 0.45 : 1}
                    />
                ))}
            </Svg>
            </Reveal>
        </View>
    );
}

// ─── Heatmap ─────────────────────────────────────────────────
function HeatmapChart({ color, completionData }: {
    color: string; completionData: DayData[];
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const points = prepare(completionData, 1).slice(-35); // Last 5 weeks
    const cols = 7;
    const cellSize = Math.min((GRAPH_WIDTH - 16) / cols, 20);
    const gap = 3;

    return (
        <View style={{ paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap }}>
                {points.map((point, index) => {
                    // Four readings, not two: kept, missed, deliberately skipped,
                    // and never asked for.
                    const filled = point.state === 'kept';
                    return (
                        <PopIn
                            key={point.date}
                            index={index}
                            style={{
                                width: cellSize, height: cellSize, borderRadius: 4,
                                backgroundColor: filled ? color : point.state === 'skipped' ? colors.textTertiary : 'transparent',
                                opacity: filled ? 1 : point.state === 'skipped' ? 0.3 : point.state === 'missed' ? 0.14 : 1,
                                borderWidth: point.state === 'off' ? 1 : point.state === 'missed' ? 0 : 0,
                                borderColor: colors.border,
                                ...(point.state === 'missed' ? { backgroundColor: colors.textTertiary } : null),
                            }}
                        />
                    );
                })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Key swatch={{ backgroundColor: color }} label="Kept" colors={colors} />
                <Key swatch={{ backgroundColor: colors.textTertiary, opacity: 0.14 }} label="Missed" colors={colors} />
                <Key swatch={{ backgroundColor: colors.textTertiary, opacity: 0.3 }} label="Skipped" colors={colors} />
                <Key swatch={{ borderWidth: 1, borderColor: colors.border }} label="Not due" colors={colors} />
            </View>
        </View>
    );
}

const Key = ({ swatch, label, colors }: { swatch: object; label: string; colors: typeof Colors.light }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={[{ width: 10, height: 10, borderRadius: 2 }, swatch]} />
        <Text style={{ fontSize: 9, color: colors.textTertiary, fontFamily: FontFamily.regular }}>{label}</Text>
    </View>
);

// ─── Streak Counter ──────────────────────────────────────────
function StreakCounter({ color, currentStreak }: {
    color: string; currentStreak: number;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <CountUp style={{ fontSize: 56, color, fontFamily: FontFamily.bold }} value={currentStreak} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="flame" size={18} color="#F59E0B" />
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: FontFamily.medium }}>
                    DAY STREAK
                </Text>
                <Ionicons name="flame" size={18} color="#F59E0B" />
            </View>
            <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 8, fontFamily: FontFamily.regular }}>
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
        <VoidCard matte style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            </View>
            {renderGraph()}
        </VoidCard>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 18,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontFamily: FontFamily.semibold,
        letterSpacing: -0.2,
    },
});
