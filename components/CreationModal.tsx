import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface CreationModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectGoal: () => void;
    onSelectHabit: () => void;
}

export const CreationModal: React.FC<CreationModalProps> = ({
    visible,
    onClose,
    onSelectGoal,
    onSelectHabit
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    const handleGoal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onClose();
        onSelectGoal();
    };

    const handleHabit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onClose();
        onSelectHabit();
    };

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
                <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View
                    entering={SlideInUp.springify().damping(20)}
                    exiting={SlideOutDown.duration(200)}
                    style={styles.container}
                >
                    <TouchableOpacity activeOpacity={1}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.handle} />
                            <Text style={[styles.title, { color: colors.textPrimary }]}>
                                What would you like to create?
                            </Text>
                        </View>

                        {/* Options */}
                        <View style={styles.options}>
                            {/* Goal Option */}
                            <TouchableOpacity
                                onPress={handleGoal}
                                style={styles.optionCard}
                            >
                                <LinearGradient
                                    colors={['#8B5CF6', '#7C3AED']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.optionGradient}
                                >
                                    <View style={styles.optionIcon}>
                                        <Ionicons name="flag" size={32} color="#fff" />
                                    </View>
                                    <Text style={styles.optionTitle}>Goal</Text>
                                    <Text style={styles.optionSubtitle}>
                                        Long-term objectives to work towards
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Habit Option */}
                            <TouchableOpacity
                                onPress={handleHabit}
                                style={styles.optionCard}
                            >
                                <LinearGradient
                                    colors={['#10B981', '#059669']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.optionGradient}
                                >
                                    <View style={styles.optionIcon}>
                                        <Ionicons name="checkmark-done" size={32} color="#fff" />
                                    </View>
                                    <Text style={styles.optionTitle}>Habit</Text>
                                    <Text style={styles.optionSubtitle}>
                                        Daily rituals and recurring tasks
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        {/* Cancel Button */}
                        <TouchableOpacity
                            onPress={onClose}
                            style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]}
                        >
                            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
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
    container: {
        backgroundColor: '#0A0A0A',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 20,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        fontFamily: 'SpaceGrotesk-Bold',
    },
    options: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 20,
    },
    optionCard: {
        flex: 1,
    },
    optionGradient: {
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        minHeight: 160,
    },
    optionIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    optionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'SpaceGrotesk-Bold',
        marginBottom: 4,
    },
    optionSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        fontFamily: 'SpaceMono-Regular',
    },
    cancelButton: {
        marginHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'SpaceGrotesk-Bold',
    },
});
