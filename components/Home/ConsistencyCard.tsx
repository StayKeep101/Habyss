import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';
import { VoidCard } from '../Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

interface ConsistencyCardProps {
    score: number; // 0-100
    onPress: () => void;
}

export const ConsistencyCard: React.FC<ConsistencyCardProps> = ({ score, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';

    const size = 38;
    const strokeWidth = 4;
    const center = size / 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const getColor = () => {
        if (score >= 80) return '#22C55E';
        if (score >= 60) return '#84CC16';
        if (score >= 40) return '#FBBF24';
        if (score >= 20) return '#F97316';
        return '#EF4444';
    };

    const color = getColor();

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
            <VoidCard glass intensity={isLight ? 20 : 80} style={[styles.container, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                <View style={styles.circleContainer}>
                    <Svg width={size} height={size}>
                        <G rotation="-90" origin={`${center}, ${center}`}>
                            <Circle
                                stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}
                                cx={center}
                                cy={center}
                                r={radius}
                                strokeWidth={strokeWidth}
                                fill="transparent"
                            />
                            <Circle
                                stroke={color}
                                cx={center}
                                cy={center}
                                r={radius}
                                strokeWidth={strokeWidth}
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                fill="transparent"
                            />
                        </G>
                    </Svg>
                    <View style={styles.iconOverlay}>
                        <Ionicons name="pulse" size={14} color={color} />
                    </View>
                </View>

                <View>
                    <Text style={[styles.value, { color }]}>{Math.round(score)}%</Text>
                    <Text style={[styles.label, { color: colors.textTertiary }]}>CONSISTENCY</Text>
                </View>
            </VoidCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    touchable: {
        flex: 1,
    },
    container: {
        flex: 1,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    circleContainer: {
        position: 'relative',
        marginBottom: 2,
    },
    iconOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    value: {
        fontSize: 24,
        fontWeight: '900',
        fontFamily: 'Lexend',
        textAlign: 'center',
        lineHeight: 24,
    },
    label: {
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
        marginTop: 2,
    },
});
