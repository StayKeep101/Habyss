import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTutorial } from '@/context/TutorialContext';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

export const TutorialOverlay = () => {
    const { isActive, step, nextStep, endTutorial } = useTutorial();
    const { theme } = useTheme();
    const colors = Colors[theme];

    if (!isActive) return null;

    const steps = [
        {
            title: "Welcome to Habyss",
            desc: "Your journey to discipline starts here. Let's show you around.",
            icon: "rocket"
        },
        {
            title: "Create a Habit",
            desc: "Tap the + button below to create your first habit protocol.",
            icon: "add-circle",
            highlightBottom: true
        },
        {
            title: "Track Progress",
            desc: "Complete habits to build streaks and level up your consistency.",
            icon: "stats-chart"
        },
        {
            title: "You're Ready",
            desc: "The void awaits. Good luck.",
            icon: "checkmark-circle"
        }
    ];

    const currentStep = steps[step];

    if (!currentStep) {
        endTutorial();
        return null;
    }

    return (
        <Modal visible={isActive} transparent animationType="fade">
            <View style={styles.container}>
                {/* dim background */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />

                <Animated.View
                    entering={SlideInDown.springify()}
                    key={step}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                    <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                        <Ionicons name={currentStep.icon as any} size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{currentStep.title}</Text>
                    <Text style={[styles.desc, { color: colors.textSecondary }]}>{currentStep.desc}</Text>

                    <TouchableOpacity
                        style={[styles.btn, { backgroundColor: colors.primary }]}
                        onPress={nextStep}
                    >
                        <Text style={[styles.btnText, { color: 'white' }]}>
                            {step === steps.length - 1 ? "Enter the Void" : "Next"}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Hand pointer for step 1 (Create Habit) */}
                {step === 1 && (
                    <Animated.View entering={FadeIn} style={styles.pointerContainer}>
                        <Ionicons name="arrow-down" size={40} color="white" />
                        <Text style={{ color: 'white', fontFamily: 'Lexend', marginTop: 8 }}>Tap + Button</Text>
                    </Animated.View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        alignItems: 'center',
        maxWidth: 400,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginBottom: 12,
        textAlign: 'center',
    },
    desc: {
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    btn: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    pointerContainer: {
        position: 'absolute',
        bottom: 120,
        alignSelf: 'center',
        alignItems: 'center',
    }
});
