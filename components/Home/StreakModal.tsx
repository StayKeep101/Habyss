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
import { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';
import { useAccentGradient } from '@/constants/AccentContext';

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
    const { primary: accentColor } = useAccentGradient();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'month'>('month');
    const [monthOffset, setMonthOffset] = useState(0); // 0 = current
    const [showShare, setShowShare] = useState(false);

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

    const calendarData = useMemo(() => {
        const now = new Date();
        // Adjust for monthOffset
        if (filter === 'month' && monthOffset !== 0) {
            now.setMonth(now.getMonth() + monthOffset);
            // If viewing past months, show WHOLE month
            now.setDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()); // End of month
        }

        let dayCount = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        // For month view, we want to align to calendar grid if simple, or just list. User asked for "Day of Week info".
        // Let's generate days for the calendar view.

        const days = [];
        // If Year, simpler. If Month, full grid logic?
        // User asked: "see previous month... information regarding days of the week".

        const anchorDate = new Date(now);
        // For Month, show all days of that month.
        if (filter === 'month') {
            anchorDate.setDate(1); // Start of month
            dayCount = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= dayCount; i++) {
                const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), i);
                days.push({
                    date: d,
                    dateStr: d.toISOString().split('T')[0],
                    completed: goalCompletedDays.includes(d.toISOString().split('T')[0]),
                    dayOfWeek: d.getDay() // 0-6
                });
            }
        } else {
            // Rolling window for week/year
            for (let i = dayCount - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                days.push({ date: d, dateStr: d.toISOString().split('T')[0], completed: goalCompletedDays.includes(d.toISOString().split('T')[0]), dayOfWeek: d.getDay() });
            }
        }

        return days;
    }, [selectedGoal, goalCompletedDays, filter, monthOffset]);

    const completedCount = calendarData.filter(d => d.completed).length;
    const rate = calendarData.length > 0 ? Math.round((completedCount / calendarData.length) * 100) : 0;

    // Month Label
    const currentMonthLabel = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + monthOffset);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [monthOffset]);

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
                                <Text style={[styles.subtitle, { color: accentColor }]}>HISTORY & METRICS</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowShare(true)} style={[styles.iconButton, { backgroundColor: accentColor + '20' }]}>
                                <Ionicons name="share-social" size={20} color={accentColor} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            <Animated.View style={contentStyle}>
                                <VoidCard glass style={styles.mainCard}>
                                    <View style={[styles.streakIcon, { backgroundColor: accentColor + '15' }]}>
                                        <Ionicons name="flame" size={36} color={accentColor} />
                                    </View>
                                    <Text style={[styles.streakValue, { color: accentColor }]}>{streak}</Text>
                                    <Text style={styles.streakLabel}>DAY STREAK</Text>

                                    {/* Deadline Display */}
                                    {selectedGoal?.targetDate && (
                                        <View style={{ marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' }}>
                                                EXTINGUISH DEADLINE: <Text style={{ color: '#fff' }}>{new Date(selectedGoal.targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                                                {new Date(selectedGoal.targetDate) > new Date() && (
                                                    <Text style={{ color: accentColor }}> ({Math.ceil((new Date(selectedGoal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} Days left)</Text>
                                                )}
                                            </Text>
                                        </View>
                                    )}
                                </VoidCard>

                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {goals.map(goal => (
                                            <TouchableOpacity key={goal.id} onPress={() => setSelectedGoalId(goal.id)} style={[styles.goalChip, selectedGoal?.id === goal.id && { backgroundColor: accentColor + '20', borderColor: accentColor }]}>
                                                <Ionicons name={(goal.icon as any) || 'flag'} size={14} color={selectedGoal?.id === goal.id ? accentColor : 'rgba(255,255,255,0.5)'} />
                                                <Text style={[styles.goalChipText, { color: selectedGoal?.id === goal.id ? accentColor : 'rgba(255,255,255,0.5)' }]} numberOfLines={1}>{goal.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>

                                {/* Month Navigation */}
                                <View style={styles.filterRow}>
                                    <TouchableOpacity onPress={() => setMonthOffset(monthOffset - 1)} style={[styles.filterBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                        <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.6)" />
                                    </TouchableOpacity>
                                    <Text style={[styles.filterText, { color: accentColor, flex: 1, textAlign: 'center' }]}>{currentMonthLabel}</Text>
                                    <TouchableOpacity onPress={() => setMonthOffset(Math.min(0, monthOffset + 1))} style={[styles.filterBtn, { backgroundColor: monthOffset === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)' }]} disabled={monthOffset === 0}>
                                        <Ionicons name="chevron-forward" size={18} color={monthOffset === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)'} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.sectionTitle}>PERFORMANCE</Text>
                                <View style={styles.statsRow}>
                                    <VoidCard glass style={styles.statCard}><Text style={styles.statValue}>{completedCount}</Text><Text style={styles.statLabel}>COMPLETED</Text></VoidCard>
                                    <VoidCard glass style={styles.statCard}><Text style={[styles.statValue, { color: '#22C55E' }]}>{rate}%</Text><Text style={styles.statLabel}>RATE</Text></VoidCard>
                                    <VoidCard glass style={styles.statCard}><Text style={styles.statValue}>{calendarData.length}</Text><Text style={styles.statLabel}>DAYS</Text></VoidCard>
                                </View>

                                <Text style={styles.sectionTitle}>ACTIVITY LOG</Text>
                                <VoidCard glass style={styles.heatmapCard}>
                                    {/* Weekday Labels - Always Visible */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 }}>
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                            <Text key={i} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, width: 28, textAlign: 'center' }}>{d}</Text>
                                        ))}
                                    </View>

                                    <View style={styles.heatmap}>
                                        {/* Blank spaces for alignment */}
                                        {calendarData.length > 0 && Array.from({ length: calendarData[0].date.getDay() }).map((_, i) => (
                                            <View key={`empty-${i}`} style={[styles.heatCell, { backgroundColor: 'transparent' }]} />
                                        ))}

                                        {calendarData.map((day, i) => (
                                            <View key={i} style={[styles.heatCell, day.completed ? { backgroundColor: accentColor } : { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                                                <Text style={{ fontSize: 8, color: day.completed ? 'white' : 'rgba(255,255,255,0.3)' }}>{day.date.getDate()}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </VoidCard>
                            </Animated.View>
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </View>
            <ShareStatsModal
                visible={showShare}
                onClose={() => setShowShare(false)}
                stats={{
                    title: "STREAK MASTER",
                    value: `${streak} FIRE`,
                    subtitle: `Consistency Rate: ${rate}%`,
                    type: 'streak'
                }}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 0, borderBottomWidth: 0, borderColor: 'rgba(249, 115, 22, 0.15)', pointerEvents: 'none' }, // Removed border
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
    heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' }, // Changed gap for better grid
    heatCell: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    navBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },
});
