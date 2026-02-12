import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Rect, G, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

const CELL_SIZE = 12; // Size of each square
const CELL_GAP = 3;   // Gap between squares
const WEEK_WIDTH = CELL_SIZE + CELL_GAP;
const MONTH_LABEL_HEIGHT = 20;

interface DayData {
    date: string;
    completed: boolean;
    value?: number;
}

interface DetailedHeatmapProps {
    completionData: DayData[];
    color: string;
    description?: string;
    fullYear?: boolean; // Whether to always show full 365 days or just provided data
}

export const DetailedHeatmap: React.FC<DetailedHeatmapProps> = ({
    completionData,
    color,
    description,
    fullYear = true
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const scrollViewRef = useRef<ScrollView>(null);
    const [scrolled, setScrolled] = useState(false);

    // Process data to fill gaps if needed
    const { gridData, monthLabels, totalWeeks } = useMemo(() => {
        // Create a map for quick lookup
        const dataMap = new Map(completionData.map(d => [d.date, d]));

        // Use today as end date
        const endDate = new Date();
        const daysToShow = 365 + endDate.getDay(); // Ensure we end on current day and backfill

        // We want the last column to be "this week" (containing today).
        // Today's day of week (0=Sun, 6=Sat)
        const todayDay = endDate.getDay();

        // We want to show exactly 53 weeks to cover a full year + overlap
        const totalWeeks = 53;
        const totalDays = totalWeeks * 7;

        const filledData: { date: string, completed: boolean, value: number, dayIndex: number, weekIndex: number }[] = [];

        // Calculate the start date of the grid
        // The grid ends on Saturday of the current week (or ensures today is in the last column)
        const gridEndDate = new Date(endDate);
        gridEndDate.setDate(endDate.getDate() + (6 - todayDay)); // Fast forward to Saturday

        // Generate grid cells
        for (let w = 0; w < totalWeeks; w++) {
            for (let d = 0; d < 7; d++) {
                // Calculate date for this cell
                // Week 0 is the oldest week
                const daysFromEnd = (totalWeeks - 1 - w) * 7 + (6 - d);
                const date = new Date(gridEndDate);
                date.setDate(gridEndDate.getDate() - daysFromEnd);

                const dateStr = date.toISOString().split('T')[0];
                const existing = dataMap.get(dateStr);

                // Only add if date is not in future relative to today
                if (date <= endDate) {
                    filledData.push({
                        date: dateStr,
                        completed: existing?.completed || false,
                        value: existing?.value || 0,
                        dayIndex: d,
                        weekIndex: w
                    });
                }
            }
        }

        // Calculate month labels
        const labels: { x: number, text: string }[] = [];
        let currentMonth = -1;

        for (let w = 0; w < totalWeeks; w++) {
            // Check the first day of each week column
            // We need to approximate the date of the column start
            const daysFromEnd = (totalWeeks - 1 - w) * 7 + 6; // Sunday of that week
            const date = new Date(gridEndDate);
            date.setDate(gridEndDate.getDate() - daysFromEnd);

            const month = date.getMonth();
            if (month !== currentMonth) {
                // Only show label if there's enough space (e.g. not immediately after another)
                // and not too close to end
                if (w > 0 && w < totalWeeks - 2) {
                    labels.push({
                        x: w * WEEK_WIDTH,
                        text: date.toLocaleDateString('en-US', { month: 'short' })
                    });
                }
                currentMonth = month;
            }
        }

        return { gridData: filledData, monthLabels: labels, totalWeeks };
    }, [completionData, fullYear]);

    // Auto scroll to end on mount
    useEffect(() => {
        if (!scrolled && scrollViewRef.current) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: false });
                setScrolled(true);
            }, 100);
        }
    }, [scrolled]);


    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {description || 'Consistency Map'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                    {completionData.filter(d => d.completed).length} completions / year
                </Text>
            </View>

            <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16 }}
            >
                <Svg height={7 * WEEK_WIDTH + MONTH_LABEL_HEIGHT + 10} width={totalWeeks * WEEK_WIDTH}>
                    {/* Month Labels */}
                    {monthLabels.map((l, i) => (
                        <SvgText
                            key={`month-${i}`}
                            x={l.x}
                            y={14}
                            fontSize={10}
                            fill={colors.textTertiary}
                            fontFamily="Lexend_400Regular"
                        >
                            {l.text}
                        </SvgText>
                    ))}

                    {/* Grid */}
                    <G y={MONTH_LABEL_HEIGHT}>
                        {gridData.map((d) => {
                            const intensity = d.completed ? 1 : (d.value ? Math.min(d.value / 5, 1) : 0); // basic intensity logic
                            const opacity = intensity > 0 ? 0.3 + (intensity * 0.7) : 0.08;
                            const fillColor = intensity > 0 ? color : colors.textTertiary;

                            return (
                                <Rect
                                    key={d.date}
                                    x={d.weekIndex * WEEK_WIDTH}
                                    y={d.dayIndex * WEEK_WIDTH}
                                    width={CELL_SIZE}
                                    height={CELL_SIZE}
                                    rx={2}
                                    fill={fillColor}
                                    opacity={opacity}
                                />
                            );
                        })}
                    </G>
                </Svg>
            </ScrollView>

            <View style={styles.footer}>
                <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: 'Lexend_400Regular' }}>
                    Less
                </Text>
                <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center', marginHorizontal: 4 }}>
                    {[0, 0.4, 0.7, 1].map((op, i) => (
                        <View
                            key={i}
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                backgroundColor: op === 0 ? colors.textTertiary : color,
                                opacity: op === 0 ? 0.08 : 0.3 + (op * 0.7)
                            }}
                        />
                    ))}
                </View>
                <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: 'Lexend_400Regular' }}>
                    More
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 14,
        fontFamily: 'Lexend_500Medium',
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 12,
        paddingRight: 4
    }
});
