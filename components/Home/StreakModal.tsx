import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Habit } from '@/lib/habits';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;
const DRAG_THRESHOLD = 100;
const BOTTOM_PADDING = 100;

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
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'week' | 'month' | 'year'>('month');
    const [isOpen, setIsOpen] = useState(false);

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
        backdropOpacity.value = withTiming(1, { duration: 300 });
    }, []);

    const closeModal = useCallback(() => {
        translateY.value = withSpring(SHEET_HEIGHT, { damping: 20, stiffness: 300 });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        setTimeout(() => {
            setIsOpen(false);
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        if (visible && !isOpen) {
            openModal();
        } else if (!visible && isOpen) {
            closeModal();
        }
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
            days.push({ date: d, dateStr: d.toISOString().split('T')[0], completed: goalCompletedDays.includes(d.toISOString().split('T')[0]), dayOfWeek: d.getDay() });
        }
        return days;
    }, [selectedGoal, goalCompletedDays, filter]);

    const completedCount = calendarDays.filter(d => d.completed).length;
    const rate = calendarDays.length > 0 ? Math.round((completedCount / calendarDays.length) * 100) : 0;

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (event.translationY > 0) {
                translateY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) {
                runOnJS(closeModal)();
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
            }
        });

    const sheetAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP),
    }));

    const handleIndicatorStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, 50], [1, 0.5], Extrapolation.CLAMP),
    }));

    if (!isOpen && !visible) return null;

    return (
        <Modal visible={isOpen || visible} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
            <View style={styles.container}>
                <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                </Animated.View>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeModal} />
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
                        <LinearGradient colors={['#1a1f2e', '#0a0d14']} style={[StyleSheet.absoluteFill, { height: SHEET_HEIGHT + BOTTOM_PADDING }]} />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder, { height: SHEET_HEIGHT + BOTTOM_PADDING }]} />

                        <Animated.View style={[styles.handleContainer, handleIndicatorStyle]}>
                            <View style={styles.handle} />
                        </Animated.View>

                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Streak History</Text>
                        </View>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: BOTTOM_PADDING }} showsVerticalScrollIndicator={false}>
                            <View style={styles.streakDisplay}>
                                <Ionicons name="flame" size={40} color="#F97316" />
                                <Text style={styles.streakValue}>{streak}</Text>
                                <Text style={styles.streakLabel}>Day Streak</Text>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50, marginHorizontal: 20 }}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {goals.map(goal => (
                                        <TouchableOpacity key={goal.id} onPress={() => setSelectedGoalId(goal.id)} style={[styles.goalChip, selectedGoal?.id === goal.id && { backgroundColor: goal.color + '20', borderColor: goal.color }]}>
                                            <Ionicons name={(goal.icon as any) || 'flag'} size={14} color={selectedGoal?.id === goal.id ? goal.color : 'rgba(255,255,255,0.5)'} />
                                            <Text style={[styles.goalChipText, { color: selectedGoal?.id === goal.id ? goal.color : 'rgba(255,255,255,0.5)' }]} numberOfLines={1}>{goal.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>

                            <View style={styles.filterRow}>
                                {(['week', 'month', 'year'] as const).map(f => (
                                    <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && { backgroundColor: '#F97316' + '20' }]}>
                                        <Text style={[styles.filterText, { color: filter === f ? '#F97316' : 'rgba(255,255,255,0.5)' }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.statsRow}>
                                <View style={styles.statBox}><Text style={styles.statNum}>{completedCount}</Text><Text style={styles.statLbl}>Completed</Text></View>
                                <View style={[styles.statBox, { backgroundColor: 'rgba(34,197,94,0.1)' }]}><Text style={[styles.statNum, { color: '#22C55E' }]}>{rate}%</Text><Text style={styles.statLbl}>Rate</Text></View>
                                <View style={styles.statBox}><Text style={styles.statNum}>{calendarDays.length}</Text><Text style={styles.statLbl}>Days</Text></View>
                            </View>

                            <View style={styles.heatmapContainer}>
                                <View style={styles.heatmap}>
                                    {calendarDays.map((day, i) => (
                                        <View key={i} style={[styles.heatCell, day.completed && { backgroundColor: selectedGoal?.color || '#F97316' }]} />
                                    ))}
                                </View>
                            </View>
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT + BOTTOM_PADDING, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(139, 92, 246, 0.3)', pointerEvents: 'none' },
    handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
    header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
    streakDisplay: { alignItems: 'center', paddingVertical: 24 },
    streakValue: { fontSize: 48, fontWeight: 'bold', color: '#F97316' },
    streakLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
    goalChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    goalChipText: { fontSize: 12, maxWidth: 80 },
    filterRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 },
    filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    filterText: { fontSize: 12, fontWeight: '600' },
    statsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, gap: 10 },
    statBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, paddingVertical: 12 },
    statNum: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    statLbl: { fontSize: 10, marginTop: 2, color: 'rgba(255,255,255,0.5)' },
    heatmapContainer: { padding: 20 },
    heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    heatCell: { width: 14, height: 14, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)' },
});
