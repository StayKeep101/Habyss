import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

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
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name="flag" size={18} color="#8B5CF6" />
                    <Text style={styles.title}>Goals Progress</Text>
                </View>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{goalsCount} Goals</Text>
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
                </View>
            </View>

            <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                    <Animated.View style={[styles.progressFill, progressStyle]}>
                        <LinearGradient
                            colors={['#8B5CF6', '#A78BFA', '#C4B5FD']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                </View>
                <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>

            <Text style={styles.subtitle}>Tap to view all goals</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
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
        gap: 8,
    },
    title: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    badgeText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    progressBg: {
        flex: 1,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressText: {
        color: '#A78BFA',
        fontSize: 18,
        fontWeight: 'bold',
        width: 50,
        textAlign: 'right',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        marginTop: 10,
        textAlign: 'center',
    },
});
