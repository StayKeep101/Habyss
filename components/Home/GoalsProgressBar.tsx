import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { VoidCard } from '../Layout/VoidCard';

interface GoalsProgressBarProps {
    progress: number; // 0-100
    onPress: () => void;
    goalsCount: number;
}

export const GoalsProgressBar: React.FC<GoalsProgressBarProps> = ({ progress, onPress, goalsCount }) => {
    const animatedWidth = useSharedValue(0);

    React.useEffect(() => {
        animatedWidth.value = withSpring(progress, { damping: 15 });
    }, [progress]);

    const progressStyle = useAnimatedStyle(() => ({
        width: `${animatedWidth.value}%`,
    }));

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <VoidCard glass intensity={80} style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Ionicons name="flag" size={16} color="#A78BFA" />
                        <Text style={styles.title}>GOALS PROGRESS</Text>
                    </View>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{goalsCount}</Text>
                        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.4)" />
                    </View>
                </View>

                <View style={styles.progressContainer}>
                    <View style={styles.progressBg}>
                        <Animated.View style={[styles.progressFill, progressStyle]}>
                            <LinearGradient
                                colors={['#8B5CF6', '#A78BFA']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>
                    </View>
                    <Text style={styles.progressText}>{Math.round(progress)}%</Text>
                </View>

                <Text style={styles.subtitle}>TRACK YOUR ACTIVE MISSIONS</Text>
            </VoidCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        // No border here, relying on VoidCard default subtle border
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    title: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1.5, // Matches Analytics Title
        fontFamily: 'Lexend',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    badgeText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: 'Lexend',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 8,
    },
    progressBg: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
        fontFamily: 'Lexend',
        width: 60,
        textAlign: 'right',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
});
