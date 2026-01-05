import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, DeviceEventEmitter } from 'react-native';
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

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.40;
const DRAG_THRESHOLD = 60;

interface CreationModalProps { }

export const CreationModal: React.FC<CreationModalProps> = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { mediumFeedback, lightFeedback } = useHaptics();
    const router = useRouter();
    const [visible, setVisible] = useState(false);

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setVisible(true);
        translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 250 });
        contentOpacity.value = withDelay(150, withTiming(1, { duration: 300 }));
    }, []);

    const closeModal = useCallback(() => {
        contentOpacity.value = withTiming(0, { duration: 100 });
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 250, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        setTimeout(() => { runOnJS(setVisible)(false); }, 250);
    }, []);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('show_creation_modal', () => {
            lightFeedback();
            openModal();
        });
        return () => subscription.remove();
    }, [openModal]);

    const handleGoal = () => {
        mediumFeedback();
        closeModal();
        setTimeout(() => router.push('/create'), 300);
    };

    const handleHabit = () => {
        mediumFeedback();
        closeModal();
        setTimeout(() => DeviceEventEmitter.emit('show_habit_modal'), 300);
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
                        <LinearGradient colors={['#0f1218', '#080a0e']} style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder]} />

                        <Animated.View style={[styles.content, contentStyle]}>
                            <Text style={styles.title}>CREATE</Text>
                            <Text style={[styles.subtitle, { color: colors.primary }]}>NEW ITEM</Text>

                            <View style={styles.optionsContainer}>
                                <TouchableOpacity onPress={handleHabit} activeOpacity={0.8} style={styles.optionCard}>
                                    <View style={[styles.optionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                        <Ionicons name="repeat" size={28} color="#10B981" />
                                    </View>
                                    <Text style={styles.optionTitle}>Habit</Text>
                                    <Text style={styles.optionDesc}>Daily routine</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleGoal} activeOpacity={0.8} style={styles.optionCard}>
                                    <View style={[styles.optionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                                        <Ionicons name="flag" size={28} color="#8B5CF6" />
                                    </View>
                                    <Text style={styles.optionTitle}>Goal</Text>
                                    <Text style={styles.optionDesc}>Big objective</Text>
                                </TouchableOpacity>
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
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: 'Lexend' },
    subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', marginTop: 2, marginBottom: 28 },
    optionsContainer: { flexDirection: 'row', gap: 12 },
    optionCard: { flex: 1, alignItems: 'center', padding: 20, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    optionIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    optionTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Lexend' },
    optionDesc: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily: 'Lexend_400Regular' },
});
