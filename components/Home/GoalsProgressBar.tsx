import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { VoidCard } from '../Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { s, vs, ms } from '@/constants/Layout';

interface GoalsProgressBarProps {
    progress: number; // 0-100
    onPress: () => void;
    goalsCount: number;
}

export const GoalsProgressBar: React.FC<GoalsProgressBarProps> = ({ progress, onPress, goalsCount }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
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
            <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.container, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Ionicons name="flag" size={s(16)} color={primary} />
                        <Text style={[styles.title, { color: colors.textPrimary }]}>GOALS PROGRESS</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
                        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{goalsCount}</Text>
                        <Ionicons name="chevron-forward" size={s(12)} color={colors.textTertiary} />
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
        padding: s(20),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: vs(16),
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
    },
    title: {
        fontSize: ms(14),
        fontWeight: '900',
        letterSpacing: 1.5,
        fontFamily: 'Lexend',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(10),
        paddingVertical: vs(6),
        borderRadius: s(12),
        gap: s(4),
    },
    badgeText: {
        fontSize: ms(12),
        fontWeight: 'bold',
        fontFamily: 'Lexend',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(16),
        marginBottom: vs(8),
    },
    progressBg: {
        flex: 1,
        height: vs(6),
        borderRadius: s(3),
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: s(3),
    },
    progressText: {
        fontSize: ms(24),
        fontWeight: '900',
        fontFamily: 'Lexend',
        width: s(60),
        textAlign: 'right',
    },
    subtitle: {
        fontSize: ms(10),
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
});
