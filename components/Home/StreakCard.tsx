import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VoidCard } from '../Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

interface StreakCardProps {
    streak: number;
    completionTier: number; // 0-4
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
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';

    const flameColors = FLAME_COLORS[completionTier] || FLAME_COLORS[0];
    const isRainbow = completionTier === 4;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
            <VoidCard glass intensity={isLight ? 20 : 80} style={[styles.container, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                <View style={styles.iconContainer}>
                    {isRainbow ? (
                        <LinearGradient
                            colors={flameColors as [string, string, ...string[]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.flameGradient}
                        >
                            <Ionicons name="flame" size={20} color="white" />
                        </LinearGradient>
                    ) : (
                        <View style={[styles.flameGradient, { backgroundColor: flameColors[0] + '30' }]}>
                            <Ionicons name="flame" size={20} color={flameColors[0]} />
                        </View>
                    )}
                </View>

                <View>
                    <Text style={[styles.value, { color: colors.textPrimary }]}>{streak}</Text>
                    <Text style={[styles.label, { color: colors.textTertiary }]}>DAY STREAK</Text>
                </View>

                {completionTier === 4 && (
                    <View style={styles.perfectBadge}>
                        <Ionicons name="star" size={10} color="#FBBF24" />
                    </View>
                )}
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
    iconContainer: {
        marginBottom: 2,
    },
    flameGradient: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
    perfectBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        padding: 4,
        borderRadius: 10,
    },
});
