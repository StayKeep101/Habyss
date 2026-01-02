import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export const CategoryOrbit = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // Mock Data
    const dataset = [
        { label: 'Health', value: 35, color: '#10B981' }, // Emerald
        { label: 'Work', value: 45, color: '#3B82F6' },   // Blue
        { label: 'Mind', value: 20, color: '#8B5CF6' },   // Violet
    ];

    const radius = 60;
    const strokeWidth = 12;
    const center = 80; // canvas 160x160
    const circumference = 2 * Math.PI * radius;

    // Animation
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.exp) });
    }, []);

    let startAngle = 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Focus Orbit</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.chartWrapper}>
                    <Svg width={160} height={160}>
                        <G rotation="-90" origin="80, 80">
                            {dataset.map((item, index) => {
                                const strokeDashoffset = circumference - (circumference * item.value) / 100;
                                const angle = (item.value / 100) * 360;

                                // We need to rotate each segment to start where the last one ended
                                // But simple circle implementation with strokeDashoffset all start at 0
                                // So we need multiple circles rotated.

                                const rotation = startAngle;
                                startAngle += angle;

                                return (
                                    <Circle
                                        key={index}
                                        cx={center}
                                        cy={center}
                                        r={radius}
                                        stroke={item.color}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray={`${(circumference * item.value) / 100} ${circumference}`}
                                        strokeDashoffset={0} // We draw the partial arc directly via dasharray spacing
                                        strokeLinecap="round"
                                        fill="transparent"
                                        rotation={rotation} // Rotate this segment
                                        origin={`${center}, ${center}`}
                                    />
                                );
                            })}
                        </G>

                        {/* Center Text */}
                        <View style={styles.centerLabel}>
                            {/* SVG doesn't support View/Text easily inside, positioning absolute outside is easier */}
                        </View>
                    </Svg>

                    <View style={[styles.absoluteCenter]}>
                        <Text style={[styles.totalText, { color: colors.textPrimary }]}>100%</Text>
                    </View>
                </View>

                <View style={styles.legend}>
                    {dataset.map((item, i) => (
                        <View key={i} style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: item.color }]} />
                            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{item.label}</Text>
                            <Text style={[styles.legendValue, { color: colors.textPrimary }]}>{item.value}%</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        padding: 20,
    },
    header: {
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    chartWrapper: {
        width: 160,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    centerLabel: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    absoluteCenter: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalText: {
        fontWeight: 'bold',
        fontSize: 24,
    },
    legend: {
        gap: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    legendText: {
        fontSize: 14,
        marginRight: 8,
        width: 50,
    },
    legendValue: {
        fontWeight: 'bold',
        fontSize: 14,
    }
});
