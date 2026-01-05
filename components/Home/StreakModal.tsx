import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    runOnJS,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Habit } from '@/lib/habits';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;
const DRAG_THRESHOLD = 100;

interface StreakModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    completedDays: Record<string, string[]>;
    streak: number;
}

export const StreakModal: React.FC<StreakModalProps> = ({ visible, onClose, goals, completedDays, streak }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [isOpen, setIsOpen] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'week' | 'month' | 'year'>('month');

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 300 });
        contentOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    }, []);

    const closeModal = useCallback(() => {
        contentOpacity.value = withTiming(0, { duration: 150 });
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        setTimeout(() => { setIsOpen(false); onClose(); }, 300);
    }, [onClose]);

    useEffect(() => {
        if (visible && !isOpen) openModal();
        else if (!visible && isOpen) closeModal();
    }, [visible]);

    const selectedGoal = goals.find(g => g.id === selectedGoalId) || goals[0];
    const goalCompletedDays = selectedGoal ? (completedDays[selectedGoal.id] || []) : [];

    const calendarDays = useMemo(() => {
        const now = new Date();
        let dayCount = filter === 'week' ? 7 : filter === 'month' ? 30 : 365;
        const days = [];
        for (let i = dayCount - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            days.push({ date: d, dateStr: d.toISOString().split('T')[0], completed: goalCompletedDays.includes(d.toISOString().split('T')[0]) });
        }
        return days;
    }, [selectedGoal, goalCompletedDays, filter]);

    const completedCount = calendarDays.filter(d => d.completed).length;
    const rate = calendarDays.length > 0 ? Math.round((completedCount / calendarDays.length) * 100) : 0;

    const panGesture = Gesture.Pan()
        .onUpdate((event) => { if (event.translationY > 0) translateY.value = event.translationY; })
        .onEnd((event) => {
            if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) runOnJS(closeModal)();
            else translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        });

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP) }));
    const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

    if (!isOpen && !visible) return null;

    return (
        <Modal visible={isOpen || visible} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
            <View style={styles.container}>
                <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
                    <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} activeOpacity={1} onPress={closeModal} />
                </Animated.View>

                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetStyle]}>
                        <LinearGradient colors={['#0f1218', '#080a0e']} style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder]} />

                        <View style={styles.header}>
                            <TouchableOpacity onPress={closeModal} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.title}>STREAK</Text>
                                <Text style={[styles.subtitle, { color: '#F97316' }]}>HISTORY & METRICS</Text>
                            </View>
                            <TouchableOpacity style={[styles.iconButton, { backgroundColor: 'rgba(249, 115, 22, 0.2)' }]}>
                                <Ionicons name="share-social" size={20} color="#F97316" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            <Animated.View style={contentStyle}>
                                <VoidCard glass style={styles.mainCard}>
                                    <View style={[styles.streakIcon, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
                                        <Ionicons name="flame" size={36} color="#F97316" />
                                    </View>
                                    <Text style={styles.streakValue}>{streak}</Text>
                                    <Text style={styles.streakLabel}>DAY STREAK</Text>
                                </VoidCard>

                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {goals.map(goal => (
                                            <TouchableOpacity key={goal.id} onPress={() => setSelectedGoalId(goal.id)} style={[styles.goalChip, selectedGoal?.id === goal.id && { backgroundColor: (goal.color || '#F97316') + '20', borderColor: goal.color || '#F97316' }]}>
                                                <Ionicons name={(goal.icon as any) || 'flag'} size={14} color={selectedGoal?.id === goal.id ? (goal.color || '#F97316') : 'rgba(255,255,255,0.5)'} />
                                                <Text style={[styles.goalChipText, { color: selectedGoal?.id === goal.id ? (goal.color || '#F97316') : 'rgba(255,255,255,0.5)' }]} numberOfLines={1}>{goal.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>

                                <View style={styles.filterRow}>
                                    {(['week', 'month', 'year'] as const).map(f => (
                                        <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && { backgroundColor: 'rgba(249, 115, 22, 0.2)' }]}>
                                            <Text style={[styles.filterText, { color: filter === f ? '#F97316' : 'rgba(255,255,255,0.5)' }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.sectionTitle}>PERFORMANCE</Text>
                                <View style={styles.statsRow}>
                                    <VoidCard glass style={styles.statCard}><Text style={styles.statValue}>{completedCount}</Text><Text style={styles.statLabel}>COMPLETED</Text></VoidCard>
                                    <VoidCard glass style={styles.statCard}><Text style={[styles.statValue, { color: '#22C55E' }]}>{rate}%</Text><Text style={styles.statLabel}>RATE</Text></VoidCard>
                                    <VoidCard glass style={styles.statCard}><Text style={styles.statValue}>{calendarDays.length}</Text><Text style={styles.statLabel}>DAYS</Text></VoidCard>
                                </View>

                                <Text style={styles.sectionTitle}>ACTIVITY</Text>
                                <VoidCard glass style={styles.heatmapCard}>
                                    <View style={styles.heatmap}>
                                        {calendarDays.map((day, i) => (
                                            <View key={i} style={[styles.heatCell, day.completed && { backgroundColor: selectedGoal?.color || '#F97316' }]} />
                                        ))}
                                    </View>
                                </VoidCard>
                            </Animated.View>
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(249, 115, 22, 0.15)', pointerEvents: 'none' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: 'Lexend' },
    subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    mainCard: { alignItems: 'center', padding: 24, marginBottom: 20 },
    streakIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    streakValue: { fontSize: 40, fontWeight: '900', color: '#F97316', fontFamily: 'Lexend' },
    streakLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular', letterSpacing: 1.5, marginTop: 4 },
    goalChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    goalChipText: { fontSize: 12, maxWidth: 80 },
    filterRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 20 },
    filterBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    filterText: { fontSize: 12, fontWeight: '600' },
    sectionTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular' },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: { flex: 1, alignItems: 'center', padding: 14 },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#fff', fontFamily: 'Lexend' },
    statLabel: { fontSize: 9, marginTop: 4, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular', letterSpacing: 0.5 },
    heatmapCard: { padding: 14 },
    heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    heatCell: { width: 12, height: 12, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)' },
});
