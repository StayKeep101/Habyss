import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Dimensions } from 'react-native';
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

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;
const DRAG_THRESHOLD = 100;
const BOTTOM_PADDING = 100;

interface ConsistencyModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    goalConsistency: Record<string, number>;
    avgConsistency: number;
}

export const ConsistencyModal: React.FC<ConsistencyModalProps> = ({ visible, onClose, goals, goalConsistency, avgConsistency }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
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
                            <Text style={styles.headerTitle}>Consistency Report</Text>
                        </View>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: BOTTOM_PADDING }} showsVerticalScrollIndicator={false}>
                            <View style={styles.avgDisplay}>
                                <View style={[styles.avgCircle, { borderColor: avgColor }]}>
                                    <Text style={[styles.avgValue, { color: avgColor }]}>{Math.round(avgConsistency)}%</Text>
                                </View>
                                <Text style={styles.avgLabel}>Overall Consistency</Text>
                                <View style={[styles.ratingBadge, { backgroundColor: avgColor + '20' }]}>
                                    <Text style={[styles.ratingText, { color: avgColor }]}>{rating}</Text>
                                </View>
                            </View>

                            <View style={styles.content}>
                                <Text style={styles.sectionTitle}>PER GOAL BREAKDOWN</Text>
                                {goals.length > 0 ? goals.map(goal => {
                                    const score = goalConsistency[goal.id] || 0;
                                    const color = getColor(score);
                                    return (
                                        <View key={goal.id} style={styles.goalRow}>
                                            <View style={[styles.goalIcon, { backgroundColor: goal.color + '15' }]}>
                                                <Ionicons name={(goal.icon as any) || 'flag'} size={16} color={goal.color || '#8B5CF6'} />
                                            </View>
                                            <View style={styles.goalInfo}>
                                                <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
                                                <View style={styles.progressBar}>
                                                    <View style={[styles.progressFill, { width: `${Math.max(score, 3)}%`, backgroundColor: color }]} />
                                                </View>
                                            </View>
                                            <View style={[styles.scoreBadge, { backgroundColor: color + '15' }]}>
                                                <Text style={[styles.scoreText, { color }]}>{Math.round(score)}%</Text>
                                            </View>
                                        </View>
                                    );
                                }) : (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="analytics-outline" size={40} color="rgba(255,255,255,0.2)" />
                                        <Text style={styles.emptyText}>No data</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.infoBox}>
                                <Ionicons name="information-circle" size={14} color="rgba(255,255,255,0.5)" />
                                <Text style={styles.infoText}>Score = days all habits done ÷ total active days</Text>
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
    avgDisplay: { alignItems: 'center', paddingVertical: 24 },
    avgCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    avgValue: { fontSize: 28, fontWeight: 'bold' },
    avgLabel: { fontSize: 13, marginBottom: 8, color: 'rgba(255,255,255,0.5)' },
    ratingBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
    ratingText: { fontSize: 12, fontWeight: '600' },
    content: { paddingHorizontal: 20 },
    sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 12, color: 'rgba(255,255,255,0.5)' },
    goalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
    goalIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    goalInfo: { flex: 1 },
    goalName: { fontSize: 13, fontWeight: '500', marginBottom: 5, color: '#fff' },
    progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    scoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 10 },
    scoreText: { fontSize: 12, fontWeight: 'bold' },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { marginTop: 10, color: 'rgba(255,255,255,0.4)' },
    infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 20, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)' },
    infoText: { fontSize: 11, flex: 1, color: 'rgba(255,255,255,0.5)' },
});
