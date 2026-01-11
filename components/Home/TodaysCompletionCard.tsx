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
    const isTrueDark = theme === 'trueDark';
    const { primary: accentColor } = useAccentGradient();

    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const allComplete = completedCount === totalCount && totalCount > 0;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
            <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.container, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                <View style={styles.iconContainer}>
                    <View style={[styles.iconGradient, { backgroundColor: (allComplete ? '#10B981' : accentColor) + '30' }]}>
                        <Ionicons
                            name={allComplete ? "checkmark-done" : "checkbox-outline"}
                            size={20}
                            color={allComplete ? '#10B981' : accentColor}
                        />
                    </View>
                </View>

                <View>
                    <Text style={[styles.value, { color: allComplete ? '#10B981' : colors.textPrimary }]}>
                        {percentage}%
                    </Text>
                    <Text style={[styles.label, { color: colors.textTertiary }]}>COMPLETION</Text>
                </View>
            </VoidCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 100, // Ensure same height as others
    },
    iconContainer: {
        marginBottom: 2,
    },
    iconGradient: {
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
});
