import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Modal } from 'react-native';
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
const BOTTOM_PADDING = 100; // Extra padding for bouncy animation

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

    const handleGoalPress = (goalId: string) => {
        closeModal();
        setTimeout(() => router.push({ pathname: '/goal-detail', params: { goalId } }), 350);
    };

    const avgProgress = goals.length > 0
        ? Math.round(goals.reduce((sum, g) => sum + (goalProgress[g.id] || 0), 0) / goals.length)
        : 0;

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
        opacity: interpolate(
            translateY.value,
            [0, SHEET_HEIGHT],
            [1, 0],
            Extrapolation.CLAMP
        ),
    }));

    const handleIndicatorStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateY.value,
            [0, 50],
            [1, 0.5],
            Extrapolation.CLAMP
        ),
    }));

    if (!isOpen && !visible) return null;

    return (
        <Modal
            visible={isOpen || visible}
            transparent
            animationType="none"
            onRequestClose={closeModal}
            statusBarTranslucent
        >
            <View style={styles.container}>
                {/* Blur backdrop */}
                <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                </Animated.View>

                {/* Tap to dismiss overlay */}
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={closeModal}
                />

                {/* Bottom sheet */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
                        {/* Gradient background */}
                        <LinearGradient
                            colors={['#1a1f2e', '#0a0d14']}
                            style={[StyleSheet.absoluteFill, { height: SHEET_HEIGHT + BOTTOM_PADDING }]}
                        />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder, { height: SHEET_HEIGHT + BOTTOM_PADDING }]} />

                        {/* Handle indicator */}
                        <Animated.View style={[styles.handleContainer, handleIndicatorStyle]}>
                            <View style={styles.handle} />
                        </Animated.View>

                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Mission Control</Text>
                        </View>

                        {/* Stats Bar */}
                        <View style={styles.statsBar}>
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: '#8B5CF6' }]}>{goals.length}</Text>
                                <Text style={styles.statLabel}>Goals</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: '#22C55E' }]}>{avgProgress}%</Text>
                                <Text style={styles.statLabel}>Avg Progress</Text>
                            </View>
                        </View>

                        {/* Goals Grid */}
                        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: BOTTOM_PADDING + 40 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.sectionTitle}>ALL GOALS</Text>
                            <View style={styles.grid}>
                                {goals.length > 0 ? goals.map(goal => {
                                    const progress = goalProgress[goal.id] || 0;
                                    return (
                                        <TouchableOpacity key={goal.id} onPress={() => handleGoalPress(goal.id)} style={[styles.goalCard, { borderColor: goal.color + '30' }]} activeOpacity={0.7}>
                                            <View style={[styles.iconCircle, { backgroundColor: goal.color + '20' }]}>
                                                <Ionicons name={(goal.icon as any) || 'flag'} size={20} color={goal.color || '#8B5CF6'} />
                                            </View>
                                            <Text style={styles.goalName} numberOfLines={2}>{goal.name}</Text>
                                            <View style={styles.progressBar}>
                                                <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: goal.color || '#8B5CF6' }]} />
                                            </View>
                                            <Text style={[styles.progressText, { color: goal.color || '#8B5CF6' }]}>{progress}%</Text>
                                        </TouchableOpacity>
                                    );
                                }) : (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="planet-outline" size={48} color="rgba(255,255,255,0.2)" />
                                        <Text style={styles.emptyText}>No goals yet</Text>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        height: SHEET_HEIGHT + BOTTOM_PADDING,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
    },
    sheetBorder: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(139, 92, 246, 0.3)',
        pointerEvents: 'none',
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    statsBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 11,
        marginTop: 2,
        color: 'rgba(255,255,255,0.5)',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 16,
        color: 'rgba(255,255,255,0.5)',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    goalCard: {
        width: (width - 52) / 2,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    goalName: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 10,
        height: 34,
        color: '#fff',
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 6,
    },
    emptyState: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
    },
});
