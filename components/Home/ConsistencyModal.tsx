import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { Habit } from '@/lib/habitsSQLite';
import { goalActivityDays } from '@/lib/goalActivity';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';

export const ConsistencyModal = ({ visible, onClose, goals, habits, history, completions }: {
    visible: boolean; onClose: () => void; goals: Habit[]; habits: Habit[];
    history: { date: string; completedIds: string[] }[]; completions: Record<string, boolean>;
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const breakdown = useMemo(() => goals.map(goal => {
        const days = goalActivityDays(habits.filter(h => h.goalId === goal.id), history, completions);
        const scheduled = days.filter(day => day.scheduledIds.length > 0).length;
        const done = days.filter(day => day.complete).length;
        return { goal, scheduled, done, score: scheduled ? Math.round(done / scheduled * 100) : 0 };
    }), [goals, habits, history, completions]);
    const tracked = breakdown.filter(item => item.scheduled > 0);
    const average = tracked.length ? Math.round(tracked.reduce((sum, item) => sum + item.score, 0) / tracked.length) : 0;
    return <VoidModal visible={visible} onClose={onClose} heightPercentage={0.78}>
        <ModalHeader title="CONSISTENCY" onBack={onClose} shareSummary={{ title: 'Consistency', value: average + '%', subtitle: 'Average goal consistency · last 90 days' }} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 1, fontFamily: 'Lexend_500Medium' }}>MISSION BREAKDOWN</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 18 }}>Days when every scheduled habit was completed, over the last 90 days. Days off are excluded.</Text>
            {breakdown.map(({ goal, scheduled, done, score }) => <VoidCard key={goal.id} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ flex: 1, fontSize: 16, color: colors.text, fontFamily: 'Lexend_500Medium' }}>{goal.name}</Text>
                    <Text style={{ fontSize: 22, color: primary, fontFamily: 'Lexend_600SemiBold' }}>{scheduled ? score + '%' : '—'}</Text>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.surfaceSecondary, marginVertical: 12, overflow: 'hidden' }}><View style={{ width: score + '%' as `${number}%`, height: 5, borderRadius: 3, backgroundColor: primary }} /></View>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{scheduled ? done + ' of ' + scheduled + ' scheduled days completed' : 'No scheduled habits in this period'}</Text>
            </VoidCard>)}
            {!goals.length && <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 24 }}>Your goals will appear here once you create them.</Text>}
        </ScrollView>
    </VoidModal>;
};
