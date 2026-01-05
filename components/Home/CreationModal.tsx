import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
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
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { Habit } from '@/lib/habits';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.50;
const DRAG_THRESHOLD = 80;
const BOTTOM_PADDING = 100;

interface CreationModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    onCreateGoal: () => void;
    onCreateHabit: () => void;
    onAddHabitToGoal: (goalId: string) => void;
}

export const CreationModal: React.FC<CreationModalProps> = ({
    visible,
    onClose,
    goals,
    onCreateGoal,
    onCreateHabit,
    onAddHabitToGoal
}) => {
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
                            <Text style={styles.headerTitle}>Create New</Text>
                        </View>

                        <View style={styles.content}>
                            {/* Main Options: Goal vs Habit */}
                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={styles.bigCard}
                                    onPress={() => { closeModal(); setTimeout(onCreateGoal, 350); }}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: '#8B5CF6' + '20' }]}>
                                        <Ionicons name="trophy" size={32} color="#8B5CF6" />
                                    </View>
                                    <Text style={styles.cardTitle}>New Goal</Text>
                                    <Text style={styles.cardSubtitle}>Set a big objective</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.bigCard}
                                    onPress={() => { closeModal(); setTimeout(onCreateHabit, 350); }}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: '#22C55E' + '20' }]}>
                                        <Ionicons name="sparkles" size={32} color="#22C55E" />
                                    </View>
                                    <Text style={styles.cardTitle}>New Habit</Text>
                                    <Text style={styles.cardSubtitle}>Build a routine</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Add to Existing Goal Section */}
                            {goals.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>ADD HABIT TO GOAL</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalsScroll}>
                                        {goals.map((goal) => (
                                            <TouchableOpacity
                                                key={goal.id}
                                                style={styles.goalChip}
                                                onPress={() => { closeModal(); setTimeout(() => onAddHabitToGoal(goal.id), 350); }}
                                            >
                                                <View style={[styles.miniIcon, { backgroundColor: (goal.color || '#8B5CF6') + '20' }]}>
                                                    <Ionicons name={(goal.icon as any) || 'trophy'} size={14} color={goal.color || '#8B5CF6'} />
                                                </View>
                                                <Text style={styles.goalText} numberOfLines={1}>{goal.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
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
    content: { padding: 20 },
    row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    bigCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    iconContainer: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 },
    cardSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
    section: { marginTop: 8 },
    sectionTitle: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: 1 },
    goalsScroll: { gap: 10 },
    goalChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    miniIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    goalText: { fontSize: 13, fontWeight: '500', color: '#fff', maxWidth: 100 },
});
