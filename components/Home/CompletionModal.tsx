import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Habit, isHabitScheduledForDate } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';

interface Props {
    visible: boolean; onClose: () => void; habits: Habit[]; completions: Record<string, boolean>;
    onToggle: (id: string) => void; onEdit?: (habit: Habit) => void; onDelete?: (habit: Habit) => void;
}
export const CompletionModal = ({ visible, onClose, habits, completions, onToggle }: Props) => {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
    const today = habits.filter(h => !h.isGoal && !h.isArchived && isHabitScheduledForDate(h, new Date()));
    const done = today.filter(h => completions[h.id]).length;
    const percent = today.length ? Math.round(done / today.length * 100) : 0;
    const shown = today.filter(h => filter === 'all' || (filter === 'done' ? completions[h.id] : !completions[h.id]));
    return <VoidModal visible={visible} onClose={onClose}>
        <ModalHeader title="TODAY'S HABITS" onBack={onClose} shareSummary={{ title: "Today's progress", value: percent + '%', subtitle: done + ' of ' + today.length + ' habits completed' }} />
        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{done} of {today.length} completed</Text>
                <Text style={{ color: primary, fontSize: 26, fontFamily: 'Lexend_600SemiBold' }}>{percent}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, marginTop: 10, backgroundColor: colors.surfaceSecondary, overflow: 'hidden' }}><View style={{ height: 6, width: percent + '%' as `${number}%`, backgroundColor: primary }} /></View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                {(['all', 'pending', 'done'] as const).map(value => <TouchableOpacity key={value} onPress={() => setFilter(value)} accessibilityState={{ selected: filter === value }}
                    style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: filter === value ? primary + '20' : colors.surfaceSecondary }}>
                    <Text style={{ color: filter === value ? primary : colors.textSecondary, fontSize: 12 }}>{value === 'all' ? 'All' : value === 'pending' ? 'Pending' : 'Done'} ({value === 'all' ? today.length : value === 'pending' ? today.length - done : done})</Text>
                </TouchableOpacity>)}
            </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 8 }}>
            {shown.map(habit => <View key={habit.id} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.surfaceSecondary, padding: 8 }}>
                <TouchableOpacity accessibilityLabel={(completions[habit.id] ? 'Uncheck ' : 'Complete ') + habit.name} accessibilityRole="checkbox" accessibilityState={{ checked: !!completions[habit.id] }} onPress={() => onToggle(habit.id)} style={{ padding: 10 }}>
                    <Ionicons name={completions[habit.id] ? 'checkmark-circle' : 'ellipse-outline'} size={25} color={completions[habit.id] ? primary : colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onClose(); router.push({ pathname: '/habit-detail', params: { habitId: habit.id } }); }} style={{ flex: 1, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontFamily: 'Lexend_400Regular' }} numberOfLines={2}>{habit.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
            </View>)}
            {!shown.length && <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 28 }}>{today.length === 0 ? 'No habits scheduled today.' : filter === 'pending' ? 'All done for today.' : 'No completed habits yet.'}</Text>}
        </ScrollView>
    </VoidModal>;
};
