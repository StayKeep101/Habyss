import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface StreakCardProps {
    streak: number;
    completionTier: number; // 0-4 (0 = none, 1 = 25%, 2 = 50%, 3 = 75%, 4 = 100%)
    onPress: () => void;
}

const FLAME_COLORS: Record<number, string[]> = {
    0: ['#F97316', '#FB923C'], // Default orange
    1: ['#F97316', '#FBBF24'], // Orange-yellow
    2: ['#3B82F6', '#60A5FA'], // Blue
    3: ['#8B5CF6', '#A78BFA'], // Purple
    4: ['#EF4444', '#F97316', '#FBBF24', '#22C55E', '#3B82F6', '#8B5CF6'], // Rainbow
};

export const StreakCard: React.FC<StreakCardProps> = ({ streak, completionTier, onPress }) => {
    const flameColors = FLAME_COLORS[completionTier] || FLAME_COLORS[0];
    const isRainbow = completionTier === 4;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
            <View style={styles.iconContainer}>
                {isRainbow ? (
                    <LinearGradient
                        colors={flameColors as [string, string, ...string[]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.flameGradient}
                    >
                        <Ionicons name="flame" size={32} color="white" />
                    </LinearGradient>
                ) : (
                    <View style={[styles.flameGradient, { backgroundColor: flameColors[0] }]}>
                        <Ionicons name="flame" size={32} color="white" />
                    </View>
                )}
            </View>

            <Text style={styles.value}>{streak}</Text>
            <Text style={styles.label}>Day Streak</Text>

            {completionTier === 4 && (
                <View style={styles.perfectBadge}>
                    <Ionicons name="star" size={10} color="#FBBF24" />
                    <Text style={styles.perfectText}>Perfect!</Text>
                </View>
            )}
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
        borderColor: 'rgba(249, 115, 22, 0.2)',
    },
    iconContainer: {
        marginBottom: 8,
    },
    flameGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    value: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
    },
    label: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginTop: 2,
    },
    perfectBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        marginTop: 8,
        gap: 4,
    },
    perfectText: {
        color: '#FBBF24',
        fontSize: 10,
        fontWeight: '600',
    },
});
