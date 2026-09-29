import { FontFamily } from '@/constants/DesignSystem';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Rect, G, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { localDateKey } from '@/lib/habitSchedule';

const CELL_SIZE = 12; // Size of each square
const CELL_GAP = 3;   // Gap between squares
const WEEK_WIDTH = CELL_SIZE + CELL_GAP;
const MONTH_LABEL_HEIGHT = 20;

interface DayData {
    date: string;
    completed: boolean;
    value?: number;
    /** Deliberately skipped — not a failure. */
    skipped?: boolean;
    /** Whether the schedule asked for it. Absent means it did. */
    scheduled?: boolean;
}

interface DetailedHeatmapProps {
    completionData: DayData[];
    color: string;
    description?: string;
    fullYear?: boolean; // Whether to always show full 365 days or just provided data
    /**
     * The day the habit began, as YYYY-MM-DD.
     *
     * Everything before it is left out rather than drawn as an empty square. A
     * habit made last week should not open on eleven months of blanks that read
     * as eleven months of failure.
     */
    startDate?: string;
}

export const DetailedHeatmap: React.FC<DetailedHeatmapProps> = ({
    completionData,
    startDate,
    color,
    description,
    fullYear = true
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    // The square a day gets when nothing happened. A step above the card rather
    // than a ghost of the text colour, so the grid is legible on its own.
    const empty = theme === 'light' ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.07)';
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

        const filledData: { date: string, completed: boolean, value: number, skipped: boolean, scheduled: boolean, dayIndex: number, weekIndex: number }[] = [];

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

                const dateStr = localDateKey(date);
                const existing = dataMap.get(dateStr);

                // Not the future, and not before the habit existed.
                if (date <= endDate && (!startDate || dateStr >= startDate)) {
                    filledData.push({
                        date: dateStr,
                        completed: existing?.completed || false,
                        value: existing?.value || 0,
                        skipped: existing?.skipped || false,
                        scheduled: existing?.scheduled !== false,
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
                        text: date.toLocaleDateString(undefined, { month: 'short' })
                    });
                }
                currentMonth = month;
            }
        }

        return { gridData: filledData, monthLabels: labels, totalWeeks };
    }, [completionData, fullYear, startDate]);

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
                            // Kept, deliberately skipped, missed, or never due —
                            // four different facts that used to render as two.
                            const kept = d.completed || (d.value ?? 0) > 0;
                            const intensity = d.completed ? 1 : Math.min((d.value ?? 0) / 5, 1);
                            // An empty day is a *square*, not an absence. Drawn
                            // at three percent it disappeared into the card and
                            // took the grid with it, so a year of check-ins read
                            // as a blank panel until you had months of them.
                            const fillColor = kept ? color : empty;
                            const opacity = kept ? 0.35 + intensity * 0.65
                                : d.skipped ? 0.9
                                    : d.scheduled ? 0.75 : 0.45;

                            return (
                                <Rect
                                    key={d.date}
                                    x={d.weekIndex * WEEK_WIDTH}
                                    y={d.dayIndex * WEEK_WIDTH}
                                    width={CELL_SIZE}
                                    height={CELL_SIZE}
                                    rx={3}
                                    fill={fillColor}
                                    opacity={opacity}
                                />
                            );
                        })}
                    </G>
                </Svg>
            </ScrollView>

            <View style={styles.footer}>
                <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: FontFamily.regular }}>
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
                                backgroundColor: op === 0 ? empty : color,
                                opacity: op === 0 ? 0.75 : 0.35 + (op * 0.65)
                            }}
                        />
                    ))}
                </View>
                <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: FontFamily.regular }}>
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
        fontFamily: FontFamily.semibold,
    },
    subtitle: {
        fontSize: 10,
        fontFamily: FontFamily.regular,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 12,
        paddingRight: 4
    }
});
