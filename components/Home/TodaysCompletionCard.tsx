import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';

// ============================================
// Today's Completion Card
// Displays how many habits have been completed today.
// ============================================

interface TodaysCompletionCardProps {
    completedCount: number;
    totalCount: number;
    onPress?: () => void;
}

export const TodaysCompletionCard: React.FC<TodaysCompletionCardProps> = ({
    completedCount,
    totalCount,
    onPress,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accentColor } = useAccentGradient();

    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const allComplete = completedCount === totalCount && totalCount > 0;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
            <VoidCard style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Ionicons
                        name={allComplete ? "checkmark-done-circle" : "checkbox-outline"}
                        size={16}
                        color={allComplete ? '#10B981' : accentColor}
                    />
                    <Text style={[styles.title, { color: colors.textSecondary }]}>COMPLETION</Text>
                </View>

                {/* Main Stat */}
                <View style={styles.content}>
                    <Text style={[styles.count, { color: allComplete ? '#10B981' : colors.textPrimary }]}>
                        {completedCount}/{totalCount}
                    </Text>
                    <Text style={[styles.percentage, { color: colors.textTertiary }]}>
                        {percentage}%
                    </Text>
                </View>

                {/* Progress Bar */}
                <View style={[styles.progressBg, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)' }]}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                width: `${percentage}%`,
                                backgroundColor: allComplete ? '#10B981' : accentColor,
                            }
                        ]}
                    />
                </View>
            </VoidCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    title: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    count: {
        fontSize: 24,
        fontWeight: '800',
        fontFamily: 'Lexend',
        letterSpacing: -0.5,
    },
    percentage: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Lexend_400Regular',
    },
    progressBg: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
});
