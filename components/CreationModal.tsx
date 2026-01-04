import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, DeviceEventEmitter } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface CreationModalProps {
    // Props can be empty as it manages its own visibility via events
}

export const CreationModal: React.FC<CreationModalProps> = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { mediumFeedback, lightFeedback } = useHaptics();
    const router = useRouter();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('show_creation_modal', () => {
            lightFeedback();
            setVisible(true);
        });
        return () => subscription.remove();
    }, []);

    const onClose = () => {
        setVisible(false);
    };

    const handleGoal = () => {
        mediumFeedback();
        setVisible(false);
        // Slightly delay navigation to allow modal to close smoothly
        setTimeout(() => {
            router.push('/create');
        }, 300);
    };

    const handleHabit = () => {
        mediumFeedback();
        setVisible(false);
        // Emit event to open the specific habit modal
        setTimeout(() => {
            DeviceEventEmitter.emit('show_habit_modal');
        }, 300);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View
                    entering={SlideInDown.springify().damping(15)}
                    exiting={SlideOutDown}
                    style={[styles.sheet, { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' }]}>

                    <LinearGradient
                        colors={['#334155', '#0f172a']} // Slate gradient
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Border Gradient Stroke via wrapper or adjust */}
                    <View style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 32, pointerEvents: 'none' }]} />

                    <View style={{ padding: 24, paddingBottom: 40 }}>
                        <View style={styles.handleContainer}>
                            <View style={styles.handle} />
                        </View>

                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                            Create New...
                        </Text>

                        <View style={styles.optionsContainer}>
                            {/* Habit Option - LEFT */}
                            <TouchableOpacity
                                onPress={handleHabit}
                                activeOpacity={0.9}
                                style={[styles.optionCard, { backgroundColor: colors.surfaceSecondary }]}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                                    <Ionicons name="repeat" size={36} color="#10B981" />
                                </View>
                                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Habit</Text>
                                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                                    Daily task
                                </Text>
                            </TouchableOpacity>

                            {/* Goal Option - RIGHT */}
                            <TouchableOpacity
                                onPress={handleGoal}
                                activeOpacity={0.9}
                                style={[styles.optionCard, { backgroundColor: colors.surfaceSecondary }]}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                                    <Ionicons name="flag" size={36} color="#8B5CF6" />
                                </View>
                                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Goal</Text>
                                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                                    Big objective
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={[styles.closeText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>

                        {/* Bottom spacer for safe area */}
                        <View style={{ height: 40 }} />
                    </View>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        width: '100%',
        maxHeight: height * 0.45,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    handleContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 24,
        textAlign: 'center',
        fontFamily: 'SpaceGrotesk-Bold',
    },
    optionsContainer: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    optionCard: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        padding: 20,
        paddingVertical: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    textContainer: {
        flex: 1,
        marginLeft: 16,
    },
    optionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
        textAlign: 'center',
        fontFamily: 'SpaceGrotesk-Bold',
    },
    optionDesc: {
        fontSize: 12,
        textAlign: 'center',
        fontFamily: 'SpaceMono-Regular',
    },
    closeButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    closeText: {
        fontSize: 16,
        fontFamily: 'SpaceGrotesk-Bold',
    }
});
