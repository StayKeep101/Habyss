import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

const { width } = Dimensions.get('window');
const BOX_SIZE = 12; // Size of each day block
const GAP = 4;
const DAYS_TO_SHOW = 90; // Approx 3 months

export const ActivityHeatmap = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // Generate mock data for visual demo (0 to 4 intensity)
    const data = useMemo(() => {
        return Array.from({ length: DAYS_TO_SHOW }, () => Math.floor(Math.random() * 5));
    }, []);

    // Layout calculation
    // We want a grid that scrolls or fits. Let's make it fit horizontal rows (weeks)
    // Actually, GitHub style is columns = weeks.
    // Let's do 7 rows (days of week), and N columns.
    const weeks = Math.ceil(DAYS_TO_SHOW / 7);

    // Scale BOX_SIZE to fit width if needed
    // standard padding 20 * 2 = 40. Width available = width - 40.
    // Width needed = weeks * (BOX_SIZE + GAP) - GAP.

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Consistency Pulse</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Last 90 Days</Text>
            </View>

            <View style={styles.chartContainer}>
                <Svg height={7 * (BOX_SIZE + GAP)} width="100%">
                    <Defs>
                        <LinearGradient id="grad1" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.4" />
                            <Stop offset="1" stopColor={colors.primary} stopOpacity="1" />
                        </LinearGradient>
                    </Defs>
                    {data.map((intensity, index) => {
                        const rowIndex = index % 7; // 0 = Sunday, etc
                        const colIndex = Math.floor(index / 7);
                        const x = colIndex * (BOX_SIZE + GAP);
                        const y = rowIndex * (BOX_SIZE + GAP);

                        // Determine color based on intensity
                        let fill = colors.surface; // 0
                        let opacity = 0.2;

                        if (intensity === 1) { fill = colors.primary; opacity = 0.4; }
                        if (intensity === 2) { fill = colors.primary; opacity = 0.6; }
                        if (intensity === 3) { fill = colors.primary; opacity = 0.8; }
                        if (intensity === 4) { fill = colors.primary; opacity = 1.0; }

                        if (intensity === 0) fill = colors.textTertiary;

                        return (
                            <Rect
                                key={index}
                                x={x}
                                y={y}
                                width={BOX_SIZE}
                                height={BOX_SIZE}
                                fill={fill}
                                opacity={opacity}
                                rx={3} // Rounded corners
                            />
                        );
                    })}
                </Svg>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
    },
    header: {
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 12,
    },
    chartContainer: {
        alignItems: 'center',
        // ScrollView could be added here if weeks > screen width
    }
});
