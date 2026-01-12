import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { VoidCard } from '@/components/Layout/VoidCard';
import { LifeAreaChart } from '@/components/Statistics/LifeAreaChart';
import { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { HabitCategory } from '@/lib/habitsSQLite';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useHaptics } from '@/hooks/useHaptics';

interface LifeAreaMatrixCardProps {
    habits: Habit[];
}

const CATEGORY_CONFIG: Record<HabitCategory, { label: string; color: string }> = {
    health: { label: 'Health', color: '#34D399' },
    fitness: { label: 'Fitness', color: '#FBBF24' },
    work: { label: 'Work', color: '#60A5FA' },
    personal: { label: 'Personal', color: '#F472B6' },
    mindfulness: { label: 'Mindfulness', color: '#A78BFA' },
    misc: { label: 'Misc', color: '#9CA3AF' },
    productivity: { label: 'Productivity', color: '#F59E0B' },
    learning: { label: 'Learning', color: '#06B6D4' },
    creativity: { label: 'Creativity', color: '#EC4899' },
    social: { label: 'Social', color: '#6366F1' },
    body: { label: 'Body', color: '#34D399' },
    wealth: { label: 'Wealth', color: '#FBBF24' },
    heart: { label: 'Heart', color: '#F472B6' },
    mind: { label: 'Mind', color: '#A78BFA' },
    soul: { label: 'Soul', color: '#8B5CF6' },
    play: { label: 'Play', color: '#F59E0B' },
    family: { label: 'Family', color: '#10B981' },
    finance: { label: 'Finance', color: '#3B82F6' },
};

export const LifeAreaMatrixCard: React.FC<LifeAreaMatrixCardProps> = ({ habits }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const [selectedCategory, setSelectedCategory] = useState<HabitCategory | null>(null);

    // Prepare Chart Data
    const chartData = useMemo(() => {
        const counts: Record<string, number> = {};
        (Object.keys(CATEGORY_CONFIG) as HabitCategory[]).forEach(cat => counts[cat] = 0);

        habits.forEach(h => {
            // Ensure we count goals as well if they are passed, or just habits. 
            // Usually Life Areas apply to both.
            if (counts[h.category] !== undefined) {
                counts[h.category]++;
            } else {
                counts['misc'] = (counts['misc'] || 0) + 1;
            }
        });

        return (Object.keys(CATEGORY_CONFIG) as HabitCategory[])
            .map(cat => ({
                category: cat,
                count: counts[cat],
                label: CATEGORY_CONFIG[cat].label,
                color: CATEGORY_CONFIG[cat].color
            }))
            .filter(d => d.count > 0)
            .sort((a, b) => b.count - a.count); // Show biggest first
    }, [habits]);

    if (chartData.length === 0) return null;

    return (
        <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, fontFamily: 'Lexend', letterSpacing: 0.5 }}>LIFE AREA MATRIX</Text>
                {/* <TouchableOpacity onPress={() => router.push('/statistics')}>
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', fontFamily: 'Lexend' }}>Full Stats</Text>
                </TouchableOpacity> */}
            </View>

            <VoidCard style={{ paddingVertical: 20, alignItems: 'center' }}>
                <LifeAreaChart
                    data={chartData}
                    selectedCategory={selectedCategory}
                    onSelectCategory={(cat) => {
                        selectionFeedback();
                        setSelectedCategory(prev => prev === cat ? null : cat);
                    }}
                />

                {/* Helper Tip */}
                <Text style={{
                    fontSize: 10,
                    color: colors.textTertiary,
                    marginTop: -10,
                    marginBottom: 10,
                    fontStyle: 'italic',
                    fontFamily: 'Lexend_400Regular'
                }}>
                    Tap segments to filter
                </Text>
            </VoidCard>
        </View>
    );
};
