import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Habit } from '@/lib/habitsSQLite';
import { VoidModal } from '@/components/Layout/VoidModal';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';

type Show = 'all' | 'goals_only' | 'habits_only';
type Focus = 'all' | 'morning' | 'afternoon' | 'evening';
type Order = 'default' | 'name' | 'progress';
interface Props {
    visible: boolean; onClose: () => void; goals: Habit[];
    show: Show; onShow: (value: Show) => void;
    focus: Focus; onFocus: (value: Focus) => void;
    goal: string | null; onGoal: (value: string | null) => void;
    order: Order; direction: 1 | -1; onOrder: (value: Order) => void; onReset: () => void;
}
export const RoadmapFilters = (props: Props) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const chip = (key: string, label: string, selected: boolean, onPress: () => void, arrow = false) =>
        <TouchableOpacity key={key} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, backgroundColor: selected ? primary + '20' : colors.surfaceSecondary, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ color: selected ? primary : colors.textSecondary, fontSize: 12, maxWidth: 190 }}>{label}</Text>
            {arrow && <Ionicons name={props.direction === 1 ? 'arrow-up' : 'arrow-down'} size={14} color={primary} />}
        </TouchableOpacity>;
    const label = (title: string, hint: string) => <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}><Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Lexend_500Medium' }}>{title}</Text><Text style={{ color: colors.textTertiary, fontSize: 11 }}>{hint}</Text></View>;
    return <VoidModal visible={props.visible} onClose={props.onClose}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 }}>
            <Text style={{ flex: 1, color: colors.text, fontSize: 18, fontFamily: 'Lexend_600SemiBold' }}>Filter roadmap</Text>
            <TouchableOpacity onPress={props.onReset} style={{ padding: 10 }}><Text style={{ color: primary, fontSize: 13 }}>Reset</Text></TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Close filters" onPress={props.onClose} style={{ padding: 8 }}><Ionicons name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 18, paddingBottom: 16 }}>
            <View>{label('Show', props.show === 'all' ? 'Everything' : 'Tap again to clear')}<View style={{ flexDirection: 'row', gap: 8 }}>
                {chip('goals', 'Goals', props.show === 'goals_only', () => props.onShow(props.show === 'goals_only' ? 'all' : 'goals_only'))}
                {chip('habits', 'Habits', props.show === 'habits_only', () => props.onShow(props.show === 'habits_only' ? 'all' : 'habits_only'))}
            </View></View>
            <View>{label('Focus', props.focus === 'all' ? 'Any time' : 'Tap again to clear')}<View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {(['morning', 'afternoon', 'evening'] as const).map(value => chip(value, value[0].toUpperCase() + value.slice(1), props.focus === value, () => props.onFocus(props.focus === value ? 'all' : value)))}
            </View></View>
            <View>{label('Goal', props.goal ? 'Tap again to clear' : 'Every goal')}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {props.goals.map(goal => chip(goal.id, goal.name, props.goal === goal.id, () => props.onGoal(props.goal === goal.id ? null : goal.id)))}
                {!props.goals.length && <Text style={{ color: colors.textTertiary, fontSize: 12 }}>No goals yet</Text>}
            </ScrollView></View>
            <View>{label('Order', 'Tap to reverse')}<View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {([{ id: 'default', label: 'Created' }, { id: 'name', label: 'Name' }, { id: 'progress', label: 'Progress' }] as const).map(item => chip(item.id, item.label, props.order === item.id, () => props.onOrder(item.id), props.order === item.id))}
            </View></View>
        </ScrollView>
    </VoidModal>;
};
