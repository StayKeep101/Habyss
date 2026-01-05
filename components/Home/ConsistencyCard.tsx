import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';

interface ConsistencyCardProps {
    score: number; // 0-100
    onPress: () => void;
}

export const ConsistencyCard: React.FC<ConsistencyCardProps> = ({ score, onPress }) => {
    const size = 56;
    const strokeWidth = 5;
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
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
            <View style={styles.circleContainer}>
                <Svg width={size} height={size}>
                    <G rotation="-90" origin={`${center}, ${center}`}>
                        <Circle
                            stroke="rgba(255,255,255,0.1)"
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
                    <Ionicons name="pulse" size={20} color={color} />
                </View>
            </View>

            <Text style={[styles.value, { color }]}>{Math.round(score)}%</Text>
            <Text style={styles.label}>Consistency</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    circleContainer: {
        position: 'relative',
        marginBottom: 8,
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
        fontWeight: 'bold',
    },
    label: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginTop: 2,
    },
});
