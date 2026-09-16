import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { Habit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { goalActivityDays, activityStreaks } from '@/lib/goalActivity';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';

interface Props {
    visible: boolean; onClose: () => void; goals: Habit[]; habits: Habit[];
    history: { date: string; completedIds: string[] }[]; completions: Record<string, boolean>;
}

export const StreakModal = ({ visible, onClose, goals, habits, history, completions }: Props) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const [goalId, setGoalId] = useState<string | null>(null);
    const [monthOffset, setMonthOffset] = useState(0);
    const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()));
    const goal = goals.find(g => g.id === goalId) || goals[0];
    const goalIndex = goals.findIndex(g => g.id === goal?.id);
    const today = localDateKey(new Date());
    const linked = useMemo(() => habits.filter(h => h.goalId === goal?.id && !h.isArchived), [habits, goal?.id]);
    const days = useMemo(() => goalActivityDays(linked, history, completions), [linked, history, completions]);
    const streaks = activityStreaks(days, today);
    const month = new Date();
    month.setDate(1);
    month.setMonth(month.getMonth() + monthOffset);
    const monthKey = localDateKey(month).slice(0, 7);
    const monthDays = days.filter(day => day.date.startsWith(monthKey));
    const checkIns = monthDays.filter(day => day.complete).length;
    const scheduled = monthDays.filter(day => day.scheduledIds.length > 0).length;
    const rate = scheduled ? Math.round(checkIns / scheduled * 100) : 0;
    const selected = days.find(day => day.date === selectedDate);
    const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const changeGoal = (direction: number) => {
        if (!goals.length) return;
        setGoalId(goals[(goalIndex + direction + goals.length) % goals.length].id);
    };
    const swipe = Gesture.Pan().activeOffsetX([-24, 24]).failOffsetY([-12, 12]).onEnd(event => {
        if (Math.abs(event.translationX) > 45) runOnJS(changeGoal)(event.translationX < 0 ? 1 : -1);
    });
    const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const selectMonth = (offset: number) => {
        setMonthOffset(offset);
        const first = new Date(); first.setDate(1); first.setMonth(first.getMonth() + offset);
        setSelectedDate(offset === 0 ? today : localDateKey(first));
    };
    return <VoidModal visible={visible} onClose={onClose} heightPercentage={0.86}>
        <ModalHeader title="STREAK" onBack={onClose} shareSummary={{ title: goal ? goal.name + ' streak' : 'Streak', value: streaks.current + ' days', subtitle: checkIns + ' completed days · ' + monthLabel }} />
        {!goal ? <View style={styles.empty}><Ionicons name="flag-outline" size={32} color={primary} /><Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Create a goal and link habits to track its streak.</Text></View> :
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>TRACKED MISSIONS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {goals.map(item => <TouchableOpacity key={item.id} onPress={() => setGoalId(item.id)} accessibilityState={{ selected: goal.id === item.id }}
                    style={[styles.chip, { backgroundColor: goal.id === item.id ? primary + '20' : colors.surfaceSecondary, borderColor: goal.id === item.id ? primary : colors.border }]}>
                    <Ionicons name={(item.icon as any) || 'flag-outline'} size={14} color={goal.id === item.id ? primary : colors.textSecondary} />
                    <Text numberOfLines={1} style={{ color: colors.text, maxWidth: 160, fontSize: 12 }}>{item.name}</Text>
                </TouchableOpacity>)}
            </ScrollView>
            <GestureDetector gesture={swipe}>
                <View style={[styles.selector, { backgroundColor: colors.surfaceSecondary }]}>
                    <TouchableOpacity accessibilityLabel="Previous goal" disabled={goals.length < 2} onPress={() => changeGoal(-1)} style={styles.arrow}><Ionicons name="chevron-back" size={20} color={colors.textSecondary} /></TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>{goal.name}</Text>
                        <Text style={{ color: primary, fontSize: 12, marginTop: 4 }}>{streaks.current} day streak · {goalIndex + 1} / {goals.length}</Text>
                    </View>
                    <TouchableOpacity accessibilityLabel="Next goal" disabled={goals.length < 2} onPress={() => changeGoal(1)} style={styles.arrow}><Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /></TouchableOpacity>
                </View>
            </GestureDetector>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {[{ label: 'Check-ins', value: String(checkIns) }, { label: 'Hit rate', value: scheduled ? rate + '%' : '—' }, { label: 'Best run · 90d', value: String(streaks.best) }].map(stat =>
                    <VoidCard key={stat.label} style={styles.stat}><Text style={{ color: primary, fontSize: 24, fontFamily: 'Lexend_600SemiBold' }}>{stat.value}</Text><Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>{stat.label}</Text></VoidCard>)}
            </View>
            <VoidCard style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <TouchableOpacity accessibilityLabel="Previous month" disabled={monthOffset <= -2} onPress={() => selectMonth(monthOffset - 1)} style={styles.arrow}><Ionicons name="chevron-back" size={17} color={monthOffset <= -2 ? colors.border : colors.textSecondary} /></TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center' }}><Text style={[styles.name, { color: colors.text, fontSize: 14 }]}>Activity map</Text><Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3 }}>{monthLabel}</Text></View>
                    <TouchableOpacity accessibilityLabel="Next month" disabled={monthOffset === 0} onPress={() => selectMonth(monthOffset + 1)} style={styles.arrow}><Ionicons name="chevron-forward" size={17} color={monthOffset === 0 ? colors.border : colors.textSecondary} /></TouchableOpacity>
                </View>
                <View style={styles.grid}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => <Text key={i} style={[styles.weekday, { color: colors.textTertiary }]}>{label}</Text>)}
                    {Array.from({ length: month.getDay() }, (_, i) => <View key={'blank' + i} style={styles.cellSlot} />)}
                    {Array.from({ length: dayCount }, (_, i) => {
                        const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
                        const key = localDateKey(date);
                        const day = days.find(d => d.date === key);
                        const future = key > today;
                        return <View key={key} style={styles.cellSlot}><TouchableOpacity disabled={future} accessibilityLabel={key + (day?.complete ? ', completed' : day?.scheduledIds.length ? ', incomplete' : ', no scheduled habits')} accessibilityState={{ selected: key === selectedDate, disabled: future }}
                            onPress={() => setSelectedDate(key)} style={[styles.cell, { opacity: future ? 0.25 : 1, borderColor: selectedDate === key ? primary : 'transparent', backgroundColor: day?.complete ? primary : colors.surfaceSecondary }]}>
                            <Text style={{ color: day?.complete ? '#fff' : colors.textSecondary, fontSize: 12 }}>{i + 1}</Text>
                            {key === today && <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: day?.complete ? '#fff' : primary, marginTop: 2 }} />}
                        </TouchableOpacity></View>;
                    })}
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 10 }}>A filled day means every scheduled habit was completed. Tap a day for details.</Text>
            </VoidCard>
            <View style={{ gap: 8 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                {selected?.scheduledIds.length ? selected.scheduledIds.map(id => <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name={selected.completedIds.includes(id) ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selected.completedIds.includes(id) ? primary : colors.textTertiary} />
                    <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 13 }}>{linked.find(h => h.id === id)?.name}</Text>
                </View>) : <Text style={{ color: colors.textTertiary, fontSize: 12 }}>No habits scheduled{selected ? '.' : ' in the available history.'}</Text>}
            </View>
        </ScrollView>}
    </VoidModal>;
};
const styles = StyleSheet.create({
    content: { padding: 18, gap: 14 }, label: { fontSize: 11, fontFamily: 'Lexend_500Medium', letterSpacing: 1 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 11, borderRadius: 14, borderWidth: 1 },
    selector: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingVertical: 10 }, arrow: { padding: 10 },
    name: { fontSize: 16, fontFamily: 'Lexend_600SemiBold', textAlign: 'center' }, stat: { flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.2857%', textAlign: 'center', fontSize: 10, marginBottom: 6 },
    cellSlot: { width: '14.2857%', padding: 3, aspectRatio: 1 }, cell: { flex: 1, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    empty: { padding: 36, gap: 16, alignItems: 'center' },
});
