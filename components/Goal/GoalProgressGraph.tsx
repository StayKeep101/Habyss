import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useAccentGradient } from '@/constants/AccentContext';
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
    const { primary } = useAccentGradient();
    const screenWidth = Dimensions.get('window').width;

    // Generate mock data if none provided or if data is too short to look good
    const chartData = useMemo(() => {
        if (data && data.length > 5) return data;

        // Create a "stock-like" upward trend mock data
        const mockMsg = [];
        let value = 30;
        for (let i = 0; i < 20; i++) {
            // Random walk with upward bias
            const change = (Math.random() - 0.3) * 10;
            value = Math.max(10, Math.min(100, value + change));
            mockMsg.push({ value });
        }
        return mockMsg;
    }, [data]);

    const graphColor = color || '#10B981'; // Green by default for "stocks/growth" look

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
});
