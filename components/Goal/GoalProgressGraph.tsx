import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

interface GoalProgressGraphProps {
    data?: { value: number }[];
    color?: string;
    height?: number;
    width?: number;
}

export const GoalProgressGraph: React.FC<GoalProgressGraphProps> = ({
    data,
    color,
    height = 80,
    width: propWidth
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const screenWidth = Dimensions.get('window').width;

    const chartData = useMemo(() => {
        return data?.filter((point) => Number.isFinite(point.value)) || [];
    }, [data]);
    const hasEnoughData = chartData.length >= 2;

    const graphColor = color || '#10B981'; // Green by default for "stocks/growth" look

    if (!hasEnoughData) {
        return (
            <View style={[styles.container, styles.emptyState, { width: propWidth || (screenWidth / 2 - 60) }]}>
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Not enough real data yet</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LineChart
                areaChart
                data={chartData}
                height={height}
                width={propWidth || (screenWidth / 2 - 60)} // Adjust width to fit in card
                spacing={propWidth ? propWidth / chartData.length : (screenWidth / 2 - 60) / chartData.length}
                initialSpacing={0}
                color={graphColor}
                thickness={2}
                startFillColor={graphColor}
                endFillColor={graphColor}
                startOpacity={0.2}
                endOpacity={0.0}
                hideDataPoints
                hideRules
                hideYAxisText
                hideAxesAndRules
                curved
                isAnimated
                animationDuration={1200}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 16,
    },
    emptyState: {
        minHeight: 80,
    },
    emptyText: {
        fontSize: 12,
        textAlign: 'center',
        fontFamily: 'Lexend_400Regular',
    },
});
