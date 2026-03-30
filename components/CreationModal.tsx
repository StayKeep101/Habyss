import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, DeviceEventEmitter, InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/Common/AppButton';
import { ModalHeader } from '@/components/Layout/ModalHeader';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.48;
const DRAG_THRESHOLD = 60;

interface CreationModalProps { }

export const CreationModal: React.FC<CreationModalProps> = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { mediumFeedback, lightFeedback } = useHaptics();
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transitionLockRef = useRef(false);

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        if (transitionLockRef.current || visible) return;
        setVisible(true);
        translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 250 });
        contentOpacity.value = withDelay(150, withTiming(1, { duration: 300 }));
    }, [visible]);

    const closeModal = useCallback(() => {
        if (!visible || transitionLockRef.current) return;
        transitionLockRef.current = true;
        contentOpacity.value = withTiming(0, { duration: 100 });
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 250, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
            setVisible(false);
            transitionLockRef.current = false;
        }, 250);
    }, [visible]);

    const closeModalImmediately = useCallback(() => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        translateY.value = SHEET_HEIGHT;
        backdropOpacity.value = 0;
        contentOpacity.value = 0;
        setVisible(false);
        transitionLockRef.current = false;
    }, []);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('show_creation_modal', () => {
            lightFeedback();
            openModal();
        });
        const closeSubscription = DeviceEventEmitter.addListener('close_creation_modal', () => {
            closeModalImmediately();
        });
        return () => {
            subscription.remove();
            closeSubscription.remove();
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, [openModal, closeModalImmediately]);

    const handleGoal = () => {
        mediumFeedback();
        DeviceEventEmitter.emit('close_habit_modal');
        closeModalImmediately();
        InteractionManager.runAfterInteractions(() => {
            router.push('/create');
        });
    };

    const handleHabit = () => {
        mediumFeedback();
        DeviceEventEmitter.emit('close_habit_modal');
        closeModalImmediately();
        InteractionManager.runAfterInteractions(() => {
            DeviceEventEmitter.emit('show_habit_modal');
        });
    };

    const panGesture = Gesture.Pan()
        .onUpdate((event) => { if (event.translationY > 0) translateY.value = event.translationY; })
        .onEnd((event) => {
            if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) runOnJS(closeModal)();
            else translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        });

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP) }));
    const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
            <View style={styles.container}>
                <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
                    <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} activeOpacity={1} onPress={closeModal} />
                </Animated.View>

                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetStyle]}>
                        <LinearGradient
                            colors={theme === 'light' ? ['#FFFFFF', '#F5F5F7'] : ['#0f1218', '#080a0e']}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder, { borderColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(139, 92, 246, 0.15)' }]} />

                        <Animated.View style={[styles.content, contentStyle]}>
                            <ModalHeader title="CREATE" subtitle="NEW ITEM" onBack={closeModal} />

                            <View style={styles.heroCopy}>
                                <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Start with the thing you want to build.</Text>
                                <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                                    Habits are repeatable systems. Goals are the bigger outcomes they support.
                                </Text>
                            </View>

                            <View style={styles.optionsContainer}>
                                <TouchableOpacity onPress={handleHabit} activeOpacity={0.8} style={[styles.optionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                    <View style={styles.optionTop}>
                                        <View style={[styles.optionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                            <Ionicons name="repeat" size={28} color="#10B981" />
                                        </View>
                                        <View style={[styles.optionBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                                            <Text style={[styles.optionBadgeText, { color: '#10B981' }]}>System</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Habit</Text>
                                    <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>Track a repeatable action, routine, or behavior.</Text>
                                    <AppButton label="Create Habit" onPress={handleHabit} variant="secondary" icon="repeat" style={styles.optionButton} />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleGoal} activeOpacity={0.8} style={[styles.optionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                    <View style={styles.optionTop}>
                                        <View style={[styles.optionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                                            <Ionicons name="flag" size={28} color="#8B5CF6" />
                                        </View>
                                        <View style={[styles.optionBadge, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                                            <Text style={[styles.optionBadgeText, { color: '#8B5CF6' }]}>Outcome</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Goal</Text>
                                    <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>Define a destination and attach habits that move it forward.</Text>
                                    <AppButton label="Create Goal" onPress={handleGoal} icon="flag" style={styles.optionButton} />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.bottomHint, { backgroundColor: theme === 'light' ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.04)', borderColor: colors.border }]}>
                                <Ionicons name="add-circle-outline" size={16} color={colors.textSecondary} />
                                <Text style={[styles.bottomHintText, { color: colors.textSecondary }]}>
                                    Habits can be dropped into goals later from your roadmap.
                                </Text>
                            </View>
                        </Animated.View>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(139, 92, 246, 0.15)', pointerEvents: 'none' },
    content: { flex: 1, paddingBottom: 22 },
    heroCopy: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20 },
    heroTitle: { fontSize: 21, lineHeight: 28, fontFamily: 'Lexend_600SemiBold' },
    heroSubtitle: { fontSize: 13, lineHeight: 20, marginTop: 8, fontFamily: 'Lexend_400Regular' },
    optionsContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
    optionCard: { flex: 1, padding: 18, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    optionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    optionIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    optionBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    optionBadgeText: { fontSize: 10, fontFamily: 'Lexend_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
    optionTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Lexend' },
    optionDesc: { fontSize: 12, lineHeight: 18, marginTop: 6, fontFamily: 'Lexend_400Regular', minHeight: 52 },
    optionButton: { marginTop: 16 },
    bottomHint: {
        marginTop: 16,
        marginHorizontal: 24,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    bottomHintText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Lexend_400Regular' },
});
