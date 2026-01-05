import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, DeviceEventEmitter } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = 340;
const DRAG_THRESHOLD = 100;

interface CreationModalProps {
    // Props can be empty as it manages its own visibility via events
}

export const CreationModal: React.FC<CreationModalProps> = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { mediumFeedback, lightFeedback } = useHaptics();
    const router = useRouter();
    const [visible, setVisible] = useState(false);

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setVisible(true);
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        backdropOpacity.value = withTiming(1, { duration: 300 });
    }, []);

    const closeModal = useCallback(() => {
        translateY.value = withSpring(SHEET_HEIGHT, { damping: 20, stiffness: 300 });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        setTimeout(() => {
            runOnJS(setVisible)(false);
        }, 300);
    }, []);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('show_creation_modal', () => {
            lightFeedback();
            openModal();
        });
        return () => subscription.remove();
    }, [openModal]);

    const onClose = () => {
        closeModal();
    };

    const handleGoal = () => {
        mediumFeedback();
        closeModal();
        setTimeout(() => {
            router.push('/create');
        }, 350);
    };

    const handleHabit = () => {
        mediumFeedback();
        closeModal();
        setTimeout(() => {
            DeviceEventEmitter.emit('show_habit_modal');
        }, 350);
    };

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            // Only allow dragging down (positive translateY)
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

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
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
                    onPress={onClose}
                />

                {/* Bottom sheet */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
                        {/* Darker gradient background */}
                        <LinearGradient
                            colors={['#1a1f2e', '#0a0d14']}
                            style={StyleSheet.absoluteFill}
                        />
                        {/* Subtle border overlay */}
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder]} />

                        {/* Handle indicator */}
                        <Animated.View style={[styles.handleContainer, handleIndicatorStyle]}>
                            <View style={styles.handle} />
                        </Animated.View>

                        {/* Content */}
                        <View style={styles.content}>
                            <Text style={[styles.title, { color: '#FFFFFF' }]}>
                                Create New
                            </Text>

                            <View style={styles.optionsContainer}>
                                {/* Habit Option */}
                                <TouchableOpacity
                                    onPress={handleHabit}
                                    activeOpacity={0.8}
                                    style={styles.optionCard}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                        <Ionicons name="repeat" size={28} color="#10B981" />
                                    </View>
                                    <Text style={styles.optionTitle}>Habit</Text>
                                    <Text style={styles.optionDesc}>Daily routine</Text>
                                </TouchableOpacity>

                                {/* Goal Option */}
                                <TouchableOpacity
                                    onPress={handleGoal}
                                    activeOpacity={0.8}
                                    style={styles.optionCard}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                                        <Ionicons name="flag" size={28} color="#8B5CF6" />
                                    </View>
                                    <Text style={styles.optionTitle}>Goal</Text>
                                    <Text style={styles.optionDesc}>Big objective</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Safe area padding */}
                        <View style={{ height: 34 }} />
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
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        minHeight: SHEET_HEIGHT,
        overflow: 'hidden',
    },
    sheetBorder: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.08)',
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
    content: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 24,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    optionsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    optionCard: {
        flex: 1,
        alignItems: 'center',
        padding: 24,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    optionDesc: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
});
