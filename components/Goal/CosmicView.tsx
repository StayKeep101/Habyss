import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, withRepeat, withTiming, Easing, useAnimatedProps } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CENTER = width / 2;
const RADIUS = 120;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CosmicViewProps {
    goalName: string;
    habits: any[]; // List of habits linked to this goal
}

export const CosmicView: React.FC<CosmicViewProps> = ({ goalName, habits }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.skyContainer}>
                <Svg height={width} width={width}>
                    <Defs>
                        <RadialGradient id="starGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                            <Stop offset="0%" stopColor="#FBbf24" stopOpacity="1" />
                            <Stop offset="100%" stopColor="#FBbf24" stopOpacity="0" />
                        </RadialGradient>
                    </Defs>

                    {/* Central Star (Goal) */}
                    <Circle cx={CENTER} cy={CENTER} r={40} fill="url(#starGrad)" />
                    <Circle cx={CENTER} cy={CENTER} r={20} fill="#F59E0B" />

                    {/* Orbit Rings */}
                    <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={colors.border} strokeWidth={1} strokeDasharray={[5, 5]} opacity={0.3} />

                    {/* Planets (Habits) */}
                    {habits.map((habit, index) => {
                        const angleStep = (2 * Math.PI) / (habits.length || 1);
                        const angle = index * angleStep;

                        // Calculate position based on static angle + rotation
                        // For simplicity in static SVG, we might need to use Reanimated for orbit movement
                        // But for now, let's just place them statically or use simple React state for animation if strictly needed.
                        // Actually, let's just place them statically for the "Constellation" look.

                        const x = CENTER + RADIUS * Math.cos(angle);
                        const y = CENTER + RADIUS * Math.sin(angle);

                        return (
                            <React.Fragment key={habit.id}>
                                <Line x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={colors.border} strokeWidth={1} opacity={0.2} />
                                <Circle cx={x} cy={y} r={12} fill={habit.color || colors.primary} />
                            </React.Fragment>
                        );
                    })}
                </Svg>

                {/* React Native Views for Labels (easier than SVG text) */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <View style={[styles.centerLabel, { top: CENTER - 60, left: CENTER - 60 }]}>
                        {/* Optional central content */}
                    </View>

                    {habits.map((habit, index) => {
                        const angleStep = (2 * Math.PI) / (habits.length || 1);
                        const angle = index * angleStep;
                        const x = CENTER + RADIUS * Math.cos(angle);
                        const y = CENTER + RADIUS * Math.sin(angle);

                        return (
                            <View
                                key={habit.id}
                                style={[
                                    styles.planetLabel,
                                    {
                                        left: x - 40,
                                        top: y + 16,
                                    }
                                ]}
                            >
                                <Text style={[styles.planetText, { color: colors.textSecondary }]}>{habit.name}</Text>
                            </View>
                        )
                    })}
                </View>
            </View>

            <View style={styles.infoContainer}>
                <Text style={[styles.goalTitle, { color: colors.textPrimary }]}>{goalName}</Text>
                <Text style={[styles.goalSubtitle, { color: colors.textSecondary }]}>{habits.length} Rituals linked</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
        alignItems: 'center',
    },
    skyContainer: {
        width: width,
        height: width,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerLabel: {
        position: 'absolute',
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    planetLabel: {
        position: 'absolute',
        width: 80,
        alignItems: 'center',
    },
    planetText: {
        fontSize: 10,
        textAlign: 'center',
        fontWeight: '600',
    },
    infoContainer: {
        alignItems: 'center',
        marginTop: -40,
        paddingBottom: 20,
    },
    goalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    goalSubtitle: {
        fontSize: 14,
    }
});
