import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { LinearGradient } from 'expo-linear-gradient';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';
import { useAccentGradient } from '@/constants/AccentContext';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;
const DRAG_THRESHOLD = 100;

interface GoalsGridModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    goalProgress: Record<string, number>;
}

export const GoalsGridModal: React.FC<GoalsGridModalProps> = ({ visible, onClose, goals, goalProgress }) => {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();
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
        setTimeout(() => {
            setIsOpen(false);
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        if (visible && !isOpen) openModal();
        else if (!visible && isOpen) closeModal();
    }, [visible]);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => { if (event.translationY > 0) translateY.value = event.translationY; })
        .onEnd((event) => {
            if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) runOnJS(closeModal)();
            else translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        });

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP) }));
    const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

    const handleGoalPress = (goalId: string) => {
        closeModal();
        setTimeout(() => router.push({ pathname: '/goal-detail', params: { goalId } }), 350);
    };

    const avgProgress = goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + (goalProgress[g.id] || 0), 0) / goals.length) : 0;

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

                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={closeModal} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.title}>GOAL PROGRESS</Text>
                                <Text style={[styles.subtitle, { color: accentColor }]}>OVERVIEW</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowShare(true)} style={[styles.iconButton, { backgroundColor: accentColor + '20' }]}>
                                <Ionicons name="share-social" size={20} color={accentColor} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            <Animated.View style={contentStyle}>
                                {/* Stats Row */}
                                <View style={styles.statsRow}>
                                    <VoidCard glass style={styles.statCard}>
                                        <View style={[styles.statIcon, { backgroundColor: accentColor + '20' }]}>
                                            <Ionicons name="planet" size={22} color={accentColor} />
                                        </View>
                                        <Text style={styles.statValue}>{goals.length}</Text>
                                        <Text style={styles.statLabel}>GOALS</Text>
                                    </VoidCard>
                                    <VoidCard glass style={styles.statCard}>
                                        <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                            <Ionicons name="trending-up" size={22} color="#10B981" />
                                        </View>
                                        <Text style={styles.statValue}>{avgProgress}%</Text>
                                        <Text style={styles.statLabel}>AVG PROGRESS</Text>
                                    </VoidCard>
                                </View>

                                <Text style={styles.sectionTitle}>ALL GOALS</Text>
                                <View style={styles.grid}>
                                    {goals.length > 0 ? goals.map(goal => {
                                        const progress = goalProgress[goal.id] || 0;
                                        return (
                                            <TouchableOpacity key={goal.id} onPress={() => handleGoalPress(goal.id)} activeOpacity={0.7}>
                                                <VoidCard glass style={styles.goalCard}>
                                                    <View style={[styles.goalIcon, { backgroundColor: accentColor + '20' }]}>
                                                        <Ionicons name={(goal.icon as any) || 'flag'} size={24} color={accentColor} />
                                                    </View>
                                                    <Text style={styles.goalName} numberOfLines={2}>{goal.name}</Text>
                                                    <View style={{ marginVertical: 8 }}>
                                                        <HalfCircleProgress
                                                            progress={progress}
                                                            size={80}
                                                            strokeWidth={6}
                                                            color={accentColor}
                                                            backgroundColor={'rgba(255,255,255,0.1)'}
                                                            textColor={'#fff'}
                                                            fontSize={14}
                                                            showPercentage={true}
                                                        />
                                                    </View>
                                                </VoidCard>
                                            </TouchableOpacity>
                                        );
                                    }) : (
                                        <VoidCard glass style={styles.emptyCard}>
                                            <Ionicons name="planet-outline" size={40} color="rgba(255,255,255,0.2)" />
                                            <Text style={styles.emptyText}>No goals yet</Text>
                                        </VoidCard>
                                    )}
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
                    title: "GOAL PROGRESS",
                    value: `${avgProgress}%`,
                    subtitle: `${goals.length} Active Goals`,
                    type: 'growth'
                }}
            />
        </Modal >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 0, borderBottomWidth: 0, borderColor: 'rgba(139, 92, 246, 0.15)', pointerEvents: 'none' }, // Removed border
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: 'Lexend' },
    subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statCard: { flex: 1, alignItems: 'center', padding: 16 },
    statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 24, fontWeight: 'bold', color: '#fff', fontFamily: 'Lexend' },
    statLabel: { fontSize: 9, marginTop: 4, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular', letterSpacing: 1 },
    sectionTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    goalCard: { width: (width - 50) / 2, padding: 14, alignItems: 'center' },
    goalIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    goalName: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 10, height: 34, color: '#fff', fontFamily: 'Lexend' },
    progressBar: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    progressText: { fontSize: 13, fontWeight: 'bold', marginTop: 6, fontFamily: 'Lexend' },
    emptyCard: { width: '100%', alignItems: 'center', padding: 40 },
    emptyText: { marginTop: 12, fontSize: 14, color: 'rgba(255,255,255,0.4)' },
});
