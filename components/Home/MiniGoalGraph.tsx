import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Line, Circle } from 'react-native-svg';
import { Habit, getCompletions } from '@/lib/habits';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';

interface MiniGoalGraphProps {
    goal: Habit;
    habits: Habit[]; // All habits, will be filtered by goalId
    color: string;
}

export const MiniGoalGraph: React.FC<MiniGoalGraphProps> = ({ goal, habits, color }) => {
    const [data, setData] = useState<{ date: string; count: number }[]>([]);
    const GRAPH_HEIGHT = 60;
    const GRAPH_WIDTH = 140; // Approx half screen width - padding

    useEffect(() => {
        const loadStats = async () => {
            // Last 7 Days for mini graph (cleaner than 14)
            const days = [];
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                days.push(d.toISOString().split('T')[0]);
            }

            const linked = habits.filter(h => h.goalId === goal.id);

            const activity = await Promise.all(days.map(async (date) => {
                const comps = await getCompletions(date);
                let count = 0;
                linked.forEach(h => { if (comps[h.id]) count++; });

                // Normalize against expected? No, raw count is fine for activity trajectory.
                return { date, count };
            }));
            setData(activity);
        };
        loadStats();
    }, [goal, habits]);

    // Curve Generator (Catmull-Rom or Simple Bezier)
    // Simple "L" is linear. We want "C".
    // A simple way to smooth is to take midpoints.
    // Or simple cubic interpolation.

    const pathD = useMemo(() => {
        if (data.length === 0) return "";

        const maxVal = Math.max(Math.max(...data.map(d => d.count)), 1);
        const stepX = GRAPH_WIDTH / (data.length - 1);

        const points = data.map((d, i) => ({
            x: i * stepX,
            y: GRAPH_HEIGHT - (d.count / maxVal) * (GRAPH_HEIGHT - 10) // Reserve 10px padding top
        }));

        // Generate Path Command
        if (points.length === 0) return "";

        // Move to first
        let d = `M ${points[0].x} ${points[0].y}`;

        // Simple Spline (Cubic Bezier between points)
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];

            const cp1x = p0.x + (p1.x - p0.x) / 2;
            const cp1y = p0.y;
            const cp2x = p1.x - (p1.x - p0.x) / 2;
            const cp2y = p1.y;

            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
        }

        // Add Area Close (Line to bottom right, line to bottom left)
        const areaD = d + ` L ${GRAPH_WIDTH} ${GRAPH_HEIGHT + 10} L 0 ${GRAPH_HEIGHT + 10} Z`;

        return { line: d, area: areaD };
    }, [data]);

    if (data.length === 0 || !pathD) return <View style={{ height: GRAPH_HEIGHT, width: GRAPH_WIDTH }} />;

    return (
        <View style={{ height: GRAPH_HEIGHT, width: '100%', overflow: 'hidden', borderRadius: 12 }}>
            <Svg height="100%" width="100%" viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT + 10}`} preserveAspectRatio="none">
                <Defs>
                    <SvgGradient id={`grad_${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity="0.3" />
                        <Stop offset="1" stopColor={color} stopOpacity="0" />
                    </SvgGradient>
                </Defs>

                <Path d={pathD.area} fill={`url(#grad_${goal.id})`} />
                <Path d={pathD.line} stroke={color} strokeWidth="2" fill="none" />

                {/* Simple Dots for non-zero points */}
                {data.map((val, i) => {
                    const maxVal = Math.max(Math.max(...data.map(d => d.count)), 1);
                    // Re-calc y coords locally or memoize completely. Minimal overhead here.
                    const x = i * (GRAPH_WIDTH / (data.length - 1));
                    const y = GRAPH_HEIGHT - (val.count / maxVal) * (GRAPH_HEIGHT - 10);
                    if (val.count === 0) return null;
                    return <Circle key={i} cx={x} cy={y} r="2" fill="white" />;
                })}
            </Svg>
        </View>
    );
};
