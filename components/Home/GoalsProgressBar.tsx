import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { VoidCard } from '../Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';

interface GoalsProgressBarProps {
    progress: number; // 0-100
    onPress: () => void;
    goalsCount: number;
}

export const GoalsProgressBar: React.FC<GoalsProgressBarProps> = ({ progress, onPress, goalsCount }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { colors: accentColors, primary } = useAccentGradient();

    const animatedWidth = useSharedValue(0);

    React.useEffect(() => {
        animatedWidth.value = withSpring(progress, { damping: 15 });
    }, [progress]);

    const progressStyle = useAnimatedStyle(() => ({
        width: `${animatedWidth.value}%`,
    }));

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <VoidCard glass intensity={isLight ? 20 : 80} style={[styles.container, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Ionicons name="flag" size={16} color={primary} />
                        <Text style={[styles.title, { color: colors.textPrimary }]}>GOALS PROGRESS</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
                        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{goalsCount}</Text>
                        <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
                    </View>
                </View>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressBg, { backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }]}>
                        <Animated.View style={[styles.progressFill, progressStyle]}>
                            <LinearGradient
                                colors={accentColors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>
                    </View>
                    <Text style={[styles.progressText, { color: colors.textPrimary }]}>{Math.round(progress)}%</Text>
                </View>

                <Text style={[styles.subtitle, { color: colors.textTertiary }]}>TRACK YOUR ACTIVE MISSIONS</Text>
            </VoidCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
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
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1.5,
        fontFamily: 'Lexend',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    badgeText: {
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
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 24,
        fontWeight: '900',
        fontFamily: 'Lexend',
        width: 60,
        textAlign: 'right',
    },
    subtitle: {
        fontSize: 10,
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
});
