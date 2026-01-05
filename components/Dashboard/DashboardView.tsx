import React from 'react';
import { View } from 'react-native';
import { HeroStats } from './HeroStats';
import { GoalsList } from './GoalsList';
import { HabitHeatmap } from './HabitHeatmap';
import { WeeklyTrends } from './WeeklyTrends';
import { DashboardData } from './Dashboard.types';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface DashboardViewProps {
    data: DashboardData;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data }) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    return (
        <View className="flex-1">
            <HeroStats
                currentStreak={data.currentStreak}
                percentAboveBest={data.percentAboveBest}
                habitScore={data.habitScore || 0}
                consistencyScore={data.consistencyScore || 0}
                weeklyData={data.weeklyData}
            />

            <GoalsList goals={data.goals} />

            <HabitHeatmap habits={data.goals.flatMap(g => g.habits)} />

            <WeeklyTrends />
        </View>
    );
};
