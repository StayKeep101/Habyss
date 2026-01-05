import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Dimensions } from 'react-native';
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
import { MiniGoalGraph } from '@/components/Home/MiniGoalGraph';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;
const DRAG_THRESHOLD = 100;

interface ConsistencyModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    habits: Habit[];
    goalConsistency: Record<string, number>;
    avgConsistency: number;
}

export const ConsistencyModal: React.FC<ConsistencyModalProps> = ({ visible, onClose, goals, habits, goalConsistency, avgConsistency }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [isOpen, setIsOpen] = useState(false);
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

    const getColor = (score: number) => {
        if (score >= 80) return '#22C55E';
        if (score >= 60) return '#84CC16';
        if (score >= 40) return '#FBBF24';
        if (score >= 20) return '#F97316';
        return '#EF4444';
    };

    const avgColor = getColor(avgConsistency);
    const rating = avgConsistency >= 80 ? 'Excellent' : avgConsistency >= 60 ? 'Good' : avgConsistency >= 40 ? 'Fair' : 'Needs Work';

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
                                <Text style={styles.title}>CONSISTENCY</Text>
                                <Text style={[styles.subtitle, { color: '#22C55E' }]}>PERFORMANCE REPORT</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowShare(true)} style={[styles.iconButton, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                                <Ionicons name="share-social" size={20} color="#22C55E" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            <Animated.View style={contentStyle}>
                                <VoidCard glass style={styles.mainCard}>
                                    <View style={[styles.scoreCircle, { borderColor: avgColor }]}>
                                        <Text style={[styles.scoreValue, { color: avgColor }]}>{Math.round(avgConsistency)}%</Text>
                                    </View>
                                    <Text style={styles.scoreName}>Overall Consistency</Text>
                                    <View style={[styles.ratingBadge, { backgroundColor: avgColor + '20' }]}>
                                        <Text style={[styles.ratingText, { color: avgColor }]}>{rating}</Text>
                                    </View>
                                </VoidCard>

                                <Text style={styles.sectionTitle}>PER GOAL ACTIVITY</Text>

                                <View style={styles.gridContainer}>
                                    {goals.length > 0 ? goals.map(goal => {
                                        const score = goalConsistency[goal.id] || 0;
                                        const color = getColor(score);
                                        return (
                                            <VoidCard key={goal.id} glass style={styles.gridCard}>
                                                <View style={styles.cardHeader}>
                                                    <View style={[styles.goalIcon, { backgroundColor: (goal.color || '#8B5CF6') + '15' }]}>
                                                        <Ionicons name={(goal.icon as any) || 'flag'} size={14} color={goal.color || '#8B5CF6'} />
                                                    </View>
                                                    <View style={[styles.miniScoreBadge, { backgroundColor: color + '15' }]}>
                                                        <Text style={[styles.miniScoreText, { color }]}>{Math.round(score)}%</Text>
                                                    </View>
                                                </View>

                                                <Text style={styles.gridGoalName} numberOfLines={1}>{goal.name}</Text>

                                                <View style={{ marginTop: 12 }}>
                                                    <MiniGoalGraph goal={goal} habits={habits} color={goal.color || colors.primary} />
                                                </View>
                                            </VoidCard>
                                        );
                                    }) : (
                                        <View style={{ width: '100%' }}>
                                            <VoidCard glass style={styles.emptyCard}>
                                                <Ionicons name="analytics-outline" size={36} color="rgba(255,255,255,0.2)" />
                                                <Text style={styles.emptyText}>No data</Text>
                                            </VoidCard>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle" size={14} color="rgba(255,255,255,0.5)" />
                                    <Text style={styles.infoText}>Score = days completed ÷ total days</Text>
                                </View>
                            </Animated.View>
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </View>
            <ShareStatsModal
                visible={showShare}
                onClose={() => setShowShare(false)}
                stats={{
                    title: "CONSISTENCY",
                    value: `${Math.round(avgConsistency)}%`,
                    subtitle: "All Time Performance",
                    type: 'consistency'
                }}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 0, borderBottomWidth: 0, borderColor: 'rgba(34, 197, 94, 0.15)', pointerEvents: 'none' }, // Removed border
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: 'Lexend' },
    subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    mainCard: { alignItems: 'center', padding: 24, marginBottom: 24 },
    scoreCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    scoreValue: { fontSize: 26, fontWeight: 'bold', fontFamily: 'Lexend' },
    scoreName: { fontSize: 13, marginBottom: 10, color: 'rgba(255,255,255,0.6)' },
    ratingBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
    ratingText: { fontSize: 12, fontWeight: '700' },
    sectionTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular' },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridCard: { width: '48%', padding: 12, marginBottom: 8, borderRadius: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    goalIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    miniScoreBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    miniScoreText: { fontSize: 10, fontWeight: '800' },
    gridGoalName: { fontSize: 12, fontWeight: '700', color: '#fff', fontFamily: 'Lexend' },
    emptyCard: { alignItems: 'center', padding: 36, width: '100%' },
    emptyText: { marginTop: 12, color: 'rgba(255,255,255,0.4)', fontSize: 14 },
    infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)' },
    infoText: { fontSize: 11, flex: 1, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular' },
});
