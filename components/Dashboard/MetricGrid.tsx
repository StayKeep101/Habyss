import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface MetricGridProps {
    totalHabitsCompleted: number;
    totalTimeInvestedMinutes: number;
    perfectDays: number;
    habitAge: number;
}

export const MetricGrid: React.FC<MetricGridProps> = ({
    totalHabitsCompleted,
    totalTimeInvestedMinutes,
    perfectDays,
    habitAge
}) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'dark'];

    const formatTime = (minutes: number) => {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    const metrics = [
        { label: 'Completions', value: totalHabitsCompleted.toString(), icon: 'checkmark-done', color: '#10B981' },
        { label: 'Time Invested', value: formatTime(totalTimeInvestedMinutes), icon: 'time', color: '#3B82F6' },
        { label: 'Perfect Days', value: perfectDays.toString(), icon: 'star', color: '#F59E0B' },
        { label: 'Habit Age', value: `${habitAge}d`, icon: 'calendar', color: '#8B5CF6' },
    ];

    return (
        <View style={styles.grid}>
            {metrics.map((metric, index) => (
                <View
                    key={metric.label}
                    style={[styles.card, { backgroundColor: colors.surfaceSecondary }]}
                >
                    <View style={[styles.iconContainer, { backgroundColor: metric.color + '20' }]}>
                        <Ionicons name={metric.icon as any} size={20} color={metric.color} />
                    </View>
                    <Text style={[styles.value, { color: colors.textPrimary }]}>{metric.value}</Text>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{metric.label}</Text>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    card: {
        width: '47%',
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    value: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    label: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
