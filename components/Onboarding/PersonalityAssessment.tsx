import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppSettings, MotivationStyle, CommunicationStyle } from '@/constants/AppSettingsContext';
import { PersonalityModeId } from '@/constants/AIPersonalities';

const { width } = Dimensions.get('window');

interface Step {
    id: string;
    title: string;
    description: string;
    options: Option[];
}

interface Option {
    id: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    value: any;
    description?: string;
}

const STEPS: Step[] = [
    {
        id: 'goal',
        title: "What is your main focus?",
        description: "We'll prioritize habits that align with your primary goal.",
        options: [
            {
                id: 'productivity',
                label: "Maximize Productivity",
                icon: 'rocket-outline',
                value: 'productivity',
                description: "Get more done, focus deeper, manage time."
            },
            {
                id: 'mental_health',
                label: "Mental Wellness",
                icon: 'leaf-outline',
                value: 'mental_health',
                description: "Reduce anxiety, practice mindfulness, sleep better."
            },
            {
                id: 'physical_health',
                label: "Physical Health",
                icon: 'fitness-outline',
                value: 'physical_health',
                description: "Exercise regularly, eat better, build strength."
            },
            {
                id: 'financial',
                label: "Financial Freedom",
                icon: 'wallet-outline',
                value: 'financial',
                description: "Save more, invest wisely, track expenses."
            }
        ]
    },
    {
        id: 'struggle',
        title: "What holds you back?",
        description: "Knowing your enemy is the first step to defeating it.",
        options: [
            {
                id: 'procrastination',
                label: "Procrastination",
                icon: 'hourglass-outline',
                value: 'procrastination',
                description: "Putting things off until the last minute."
            },
            {
                id: 'consistency',
                label: "Inconsistency",
                icon: 'pulse-outline',
                value: 'consistency',
                description: "Starting strong but falling off quickly."
            },
            {
                id: 'overwhelm',
                label: "Overwhelm",
                icon: 'flash-off-outline',
                value: 'overwhelm',
                description: "Too many tasks, not knowing where to start."
            },
            {
                id: 'distraction',
                label: "Distractions",
                icon: 'notifications-off-outline',
                value: 'distraction',
                description: "Social media, notifications, losing focus."
            }
        ]
    },
    {
        id: 'motivation',
        title: "How do you stay motivated?",
        description: "Echo will adapt its coaching style to fuel your drive.",
        options: [
            {
                id: 'gentle',
                label: "Gentle Encouragement",
                icon: 'heart-outline',
                value: 'gentle',
                description: "Celebrate small wins, positive reinforcement, kind reminders."
            },
            {
                id: 'tough_love',
                label: "Tough Love",
                icon: 'flame-outline',
                value: 'tough_love',
                description: "No excuses, direct feedback, push me to my limits."
            }
        ]
    },
    {
        id: 'communication',
        title: "How should Echo talk to you?",
        description: "Choose the tone that resonates with you deeply.",
        options: [
            {
                id: 'empathetic',
                label: "Empathetic & Understanding",
                icon: 'hand-left-outline',
                value: 'empathetic',
                description: "Validates feelings, supportive, soft spoken."
            },
            {
                id: 'direct',
                label: "Direct & Concise",
                icon: 'flash-outline',
                value: 'direct',
                description: "Straight to the point, efficient, action-oriented."
            },
            {
                id: 'philosophical',
                label: "Philosophical & Deep",
                icon: 'planet-outline',
                value: 'philosophical',
                description: "Connects habits to life's meaning, wise, reflective."
            }
        ]
    },
    {
        id: 'personality',
        title: "Choose Echo's Vibe",
        description: "Select the archetype that inspires you most.",
        options: [
            { id: 'mentor', label: 'The Mentor', icon: 'school-outline', value: 'mentor', description: "Wise, patient, guiding." },
            { id: 'drill_sergeant', label: 'Drill Sergeant', icon: 'megaphone-outline', value: 'drill_sergeant', description: "High intensity, discipline focused." },
            { id: 'friend', label: 'Best Friend', icon: 'people-outline', value: 'friend', description: "Casual, supportive, fun." },
            { id: 'stoic', label: 'The Stoic', icon: 'file-tray-full-outline', value: 'stoic' as any, description: "Calm, rational, focused on virtue." },
        ]
    }
];

interface Props {
    onComplete: () => void;
}

export const PersonalityAssessment: React.FC<Props> = ({ onComplete }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback, successFeedback } = useHaptics();
    const { setMotivationStyle, setCommunicationStyle, setAIPersonality } = useAppSettings();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [selections, setSelections] = useState<Record<string, any>>({});

    const currentStep = STEPS[currentStepIndex];

    const handleSelect = async (option: Option) => {
        selectionFeedback();
        setSelections(prev => ({ ...prev, [currentStep.id]: option.value }));

        // Save immediately
        if (currentStep.id === 'motivation') {
            setMotivationStyle(option.value as MotivationStyle);
        } else if (currentStep.id === 'communication') {
            setCommunicationStyle(option.value as CommunicationStyle);
        } else if (currentStep.id === 'personality') {
            setAIPersonality(option.value as PersonalityModeId);
        }

        // Delay to show selection then move next
        setTimeout(() => {
            if (currentStepIndex < STEPS.length - 1) {
                setCurrentStepIndex(prev => prev + 1);
            } else {
                successFeedback();
                onComplete();
            }
        }, 400);
    };

    return (
        <View style={styles.container}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                {STEPS.map((step, index) => (
                    <View
                        key={step.id}
                        style={[
                            styles.progressBar,
                            {
                                backgroundColor: index <= currentStepIndex ? '#EC4899' : 'rgba(255,255,255,0.1)',
                                flex: 1
                            }
                        ]}
                    />
                ))}
            </View>

            <Animated.View
                key={currentStep.id}
                entering={SlideInRight}
                exiting={SlideOutLeft}
                style={styles.content}
            >
                <Text style={[styles.title, { color: colors.text }]}>{currentStep.title}</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>{currentStep.description}</Text>

                <View style={styles.optionsContainer}>
                    {currentStep.options.map((option) => {
                        const isSelected = selections[currentStep.id] === option.value;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={[
                                    styles.optionCard,
                                    {
                                        backgroundColor: isSelected ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255,255,255,0.05)',
                                        borderColor: isSelected ? '#EC4899' : 'transparent',
                                        borderWidth: 1
                                    }
                                ]}
                                onPress={() => handleSelect(option)}
                            >
                                <LinearGradient
                                    colors={isSelected ? ['#EC4899', '#8B5CF6'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                                    style={styles.iconContainer}
                                >
                                    <Ionicons name={option.icon} size={24} color="#fff" />
                                </LinearGradient>
                                <View style={styles.textContainer}>
                                    <Text style={[styles.optionLabel, { color: colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                                        {option.label}
                                    </Text>
                                    {option.description && (
                                        <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                                            {option.description}
                                        </Text>
                                    )}
                                </View>
                                {isSelected && (
                                    <Animated.View entering={FadeIn} style={styles.checkIcon}>
                                        <Ionicons name="checkmark-circle" size={24} color="#EC4899" />
                                    </Animated.View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
    },
    progressContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 40,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 32,
        fontFamily: 'Lexend_700Bold',
        marginBottom: 12,
        lineHeight: 40,
    },
    description: {
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
        marginBottom: 40,
        lineHeight: 24,
    },
    optionsContainer: {
        gap: 16,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        minHeight: 80,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 18,
        marginBottom: 4,
    },
    optionDesc: {
        fontSize: 13,
    },
    checkIcon: {
        marginLeft: 12,
    },
});
