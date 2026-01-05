import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CENTER = width / 2 - 24; // Account for padding
const RADIUS = 100;

interface CosmicViewProps {
    goalName: string;
    habits: any[]; // List of habits linked to this goal
}

export const CosmicView: React.FC<CosmicViewProps> = ({ goalName, habits }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    const habitCount = habits.length;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.skyContainer}>
                <Svg height={280} width={width - 48}>
                    <Defs>
                        <RadialGradient id="starGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                            <Stop offset="0%" stopColor="#FBbf24" stopOpacity="1" />
                            <Stop offset="100%" stopColor="#FBbf24" stopOpacity="0" />
                        </RadialGradient>
                    </Defs>

                    {/* Orbit Ring */}
                    <Circle
                        cx={CENTER}
                        cy={140}
                        r={RADIUS}
                        stroke={colors.border}
                        strokeWidth={1}
                        strokeDasharray={[5, 5]}
                        opacity={0.3}
                        fill="transparent"
                    />

                    {/* Central Star (Goal) */}
                    <Circle cx={CENTER} cy={140} r={35} fill="url(#starGrad)" />
                    <Circle cx={CENTER} cy={140} r={18} fill="#F59E0B" />

                    {/* Planets (Habits) - only show if habits exist */}
                    {habitCount > 0 ? (
                        habits.map((habit, index) => {
                            const angleStep = (2 * Math.PI) / habitCount;
                            const angle = index * angleStep - Math.PI / 2; // Start from top
                            const x = CENTER + RADIUS * Math.cos(angle);
                            const y = 140 + RADIUS * Math.sin(angle);

                            return (
                                <React.Fragment key={habit.id}>
                                    <Line
                                        x1={CENTER}
                                        y1={140}
                                        x2={x}
                                        y2={y}
                                        stroke={colors.border}
                                        strokeWidth={1}
                                        opacity={0.3}
                                    />
                                    <Circle
                                        cx={x}
                                        cy={y}
                                        r={10}
                                        fill={habit.completed ? colors.success : colors.primary}
                                    />
                                </React.Fragment>
                            );
                        })
                    ) : (
                        // Show placeholder orbit dots when no habits
                        [0, 1, 2, 3].map((_, index) => {
                            const angle = (index * Math.PI / 2) - Math.PI / 2;
                            const x = CENTER + RADIUS * Math.cos(angle);
                            const y = 140 + RADIUS * Math.sin(angle);
                            return (
                                <Circle
                                    key={index}
                                    cx={x}
                                    cy={y}
                                    r={6}
                                    fill={colors.border}
                                    opacity={0.2}
                                />
                            );
                        })
                    )}
                </Svg>
            </View>

            {/* Goal Info */}
            <View style={styles.infoContainer}>
                <Text style={[styles.goalTitle, { color: colors.textPrimary }]}>{goalName}</Text>
                <Text style={[styles.goalSubtitle, { color: colors.textSecondary }]}>
                    {habitCount} {habitCount === 1 ? 'Ritual' : 'Rituals'} linked
                </Text>
            </View>

            {/* Legend */}
            <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={[styles.legendText, { color: colors.textTertiary }]}>Your Goal</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.legendText, { color: colors.textTertiary }]}>Linked Habits</Text>
                </View>
                {habitCount > 0 && (
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                        <Text style={[styles.legendText, { color: colors.textTertiary }]}>Completed</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
    },
    skyContainer: {
        width: '100%',
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoContainer: {
        alignItems: 'center',
        paddingBottom: 16,
    },
    goalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
        fontFamily: 'Lexend',
    },
    goalSubtitle: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 16,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
