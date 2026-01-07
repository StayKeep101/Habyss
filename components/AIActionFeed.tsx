/**
 * AI Action Feed Component
 * 
 * Visual overlay showing the AI "navigating" and executing actions
 * with step-by-step progress animation.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Animated,
    Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { ActionStep } from '@/lib/aiAgentService';

interface AIActionFeedProps {
    visible: boolean;
    steps: ActionStep[];
    currentStepIndex: number;
    onComplete?: () => void;
}

export const AIActionFeed: React.FC<AIActionFeedProps> = ({
    visible,
    steps,
    currentStepIndex,
    onComplete,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    const slideAnim = useRef(new Animated.Value(200)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Slide in animation
    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 200,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    // Pulse animation for loading indicator
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 500,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // Progress animation
    useEffect(() => {
        const progress = (currentStepIndex + 1) / steps.length;
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [currentStepIndex, steps.length]);

    const getStepIcon = (step: ActionStep, index: number) => {
        if (index < currentStepIndex) {
            return <Ionicons name="checkmark-circle" size={20} color={colors.success} />;
        }
        if (index === currentStepIndex) {
            return (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Ionicons name="ellipse" size={16} color={colors.primary} />
                </Animated.View>
            );
        }
        return <Ionicons name="ellipse-outline" size={16} color={colors.textTertiary} />;
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={styles.overlay}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                <Animated.View
                    style={[
                        styles.container,
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    <LinearGradient
                        colors={['rgba(59, 130, 246, 0.1)', 'rgba(139, 92, 246, 0.1)', 'rgba(236, 72, 153, 0.1)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientBorder}
                    >
                        <View style={[styles.content, { backgroundColor: colors.surface }]}>
                            {/* Header */}
                            <View style={styles.header}>
                                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                    <LinearGradient
                                        colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.avatarGradient}
                                    >
                                        <Ionicons name="sparkles" size={16} color="#fff" />
                                    </LinearGradient>
                                </Animated.View>
                                <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                                    ABYSS is working...
                                </Text>
                            </View>

                            {/* Steps */}
                            <View style={styles.stepsContainer}>
                                {steps.map((step, index) => (
                                    <View key={step.id} style={styles.stepRow}>
                                        {getStepIcon(step, index)}
                                        <Text
                                            style={[
                                                styles.stepText,
                                                {
                                                    color: index <= currentStepIndex
                                                        ? colors.textPrimary
                                                        : colors.textTertiary,
                                                    fontWeight: index === currentStepIndex ? '600' : '400',
                                                },
                                            ]}
                                        >
                                            {step.label}
                                            {index < currentStepIndex && ' ✓'}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            {/* Progress Bar */}
                            <View style={[styles.progressContainer, { backgroundColor: colors.surfaceSecondary }]}>
                                <Animated.View
                                    style={[
                                        styles.progressBar,
                                        {
                                            width: progressAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0%', '100%'],
                                            }),
                                        },
                                    ]}
                                >
                                    <LinearGradient
                                        colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                </Animated.View>
                            </View>
                        </View>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 120,
    },
    container: {
        width: '90%',
        maxWidth: 360,
    },
    gradientBorder: {
        padding: 2,
        borderRadius: 20,
    },
    content: {
        borderRadius: 18,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    avatarGradient: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    stepsContainer: {
        gap: 12,
        marginBottom: 16,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    stepText: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
    },
    progressContainer: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2,
    },
});

export default AIActionFeed;
