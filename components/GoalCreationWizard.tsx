import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Keyboard,
    TouchableWithoutFeedback,
    Platform,
    KeyboardAvoidingView,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
    interpolate,
    Extrapolate,
    runOnJS
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';

import { addHabit, HabitCategory } from '@/lib/habits';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';

const { width, height } = Dimensions.get('window');

interface GoalCreationWizardProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const STEPS = ['VISION', 'PURPOSE', 'DEADLINE', 'SYMBOL', 'COMMIT'];

const PRESET_GRADIENTS = {
    purple: ['#2e1065', '#4c1d95', '#0f172a'],
    blue: ['#172554', '#1e40af', '#0f172a'],
    green: ['#064e3b', '#047857', '#0f172a'],
    red: ['#7f1d1d', '#b91c1c', '#0f172a'],
    orange: ['#7c2d12', '#c2410c', '#0f172a'],
};

const CATEGORIES: { key: HabitCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'health', label: 'Health', icon: 'heart' },
    { key: 'fitness', label: 'Fitness', icon: 'barbell' },
    { key: 'work', label: 'Career', icon: 'briefcase' },
    { key: 'personal', label: 'Growth', icon: 'person' },
    { key: 'mindfulness', label: 'Mind', icon: 'leaf' },
    { key: 'misc', label: 'Life', icon: 'grid' },
];

export const GoalCreationWizard: React.FC<GoalCreationWizardProps> = ({ visible, onClose, onSuccess }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, mediumFeedback, successFeedback, selectionFeedback } = useHaptics();

    // State
    const [step, setStep] = useState(0);
    const [name, setName] = useState('');
    const [why, setWhy] = useState('');
    const [targetDate, setTargetDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // +30 days
    const [category, setCategory] = useState<HabitCategory>('personal');
    const [selectedIcon, setSelectedIcon] = useState<string>('trophy');
    const [selectedTheme, setSelectedTheme] = useState<keyof typeof PRESET_GRADIENTS>('purple');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Animations
    const progress = useSharedValue(0);
    const holdProgress = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setStep(0);
            setName('');
            setWhy('');
            setTargetDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
            setCategory('personal');
            setSelectedIcon('trophy');
            holdProgress.value = 0;
            progress.value = withTiming(0);
        }
    }, [visible]);

    useEffect(() => {
        progress.value = withTiming(step / (STEPS.length - 1));
    }, [step]);

    const handleNext = () => {
        lightFeedback();
        if (step < STEPS.length - 1) {
            setStep(s => s + 1);
        }
    };

    const handleBack = () => {
        lightFeedback();
        if (step > 0) {
            setStep(s => s - 1);
        } else {
            onClose();
        }
    };

    // Commit Hold Logic
    const holdInterval = useRef<NodeJS.Timeout | null>(null);

    const startHold = () => {
        mediumFeedback();
        holdProgress.value = withTiming(1, { duration: 1500 }, (finished) => {
            if (finished) {
                runOnJS(submitGoal)();
            }
        });
    };

    const stopHold = () => {
        holdProgress.value = withTiming(0);
    };

    const submitGoal = async () => {
        setIsSubmitting(true);
        successFeedback();

        try {
            await addHabit({
                name: name.trim(),
                description: why.trim(),
                isGoal: true, // EXPLICITLY TRUE
                targetDate: targetDate.toISOString(),
                category: category,
                icon: selectedIcon,
                type: 'build',
            });

            // Wait a moment for the success feedback to be felt
            setTimeout(() => {
                setIsSubmitting(false);
                onSuccess();
                onClose();
            }, 500);
        } catch (error) {
            console.error(error);
            setIsSubmitting(false);
        }
    };

    const holdStyle = useAnimatedStyle(() => {
        return {
            width: `${holdProgress.value * 100}%`,
        };
    });

    const renderStepContent = () => {
        switch (step) {
            case 0: // VISION
                return (
                    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.stepContainer}>
                        <Text style={styles.question}>What is your main goal?</Text>
                        <TextInput
                            style={styles.mainInput}
                            placeholder="e.g. Run a Marathon"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                            returnKeyType="next"
                            onSubmitEditing={() => name.length > 0 && handleNext()}
                        />
                        <Text style={styles.helper}>Dream big. You can break it down later.</Text>
                    </Animated.View>
                );
            case 1: // PURPOSE
                return (
                    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.stepContainer}>
                        <Text style={styles.question}>Why does this matter?</Text>
                        <TextInput
                            style={[styles.mainInput, { fontSize: 24 }]}
                            placeholder="e.g. To prove to myself I can..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={why}
                            onChangeText={setWhy}
                            autoFocus
                            multiline
                            numberOfLines={3}
                            returnKeyType="next"
                        />
                        <Text style={styles.helper}>Your "Why" will keep you going when it gets hard.</Text>
                    </Animated.View>
                );
            case 2: // DEADLINE
                return (
                    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.stepContainer}>
                        <Text style={styles.question}>When will you achieve this?</Text>
                        <View style={styles.datePickerContainer}>
                            <DateTimePicker
                                value={targetDate}
                                mode="date"
                                display="spinner"
                                onChange={(_, date) => date && setTargetDate(date)}
                                textColor="white"
                                themeVariant="dark"
                                minimumDate={new Date()}
                            />
                        </View>
                        <Text style={styles.helper}>A goal without a deadline is just a dream.</Text>
                    </Animated.View>
                );
            case 3: // SYMBOL
                return (
                    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.stepContainer}>
                        <Text style={styles.question}>Define the vibe.</Text>

                        <Text style={styles.label}>CATEGORY</Text>
                        <View style={styles.categoryGrid}>
                            {CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat.key}
                                    style={[styles.catChip, category === cat.key && styles.catChipActive]}
                                    onPress={() => {
                                        setCategory(cat.key);
                                        selectionFeedback();
                                    }}
                                >
                                    <Ionicons name={cat.icon as any} size={16} color={category === cat.key ? '#fff' : 'rgba(255,255,255,0.6)'} />
                                    <Text style={[styles.catText, category === cat.key && styles.catTextActive]}>{cat.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.label, { marginTop: 24 }]}>THEME (Visual Only)</Text>
                        <View style={styles.themeGrid}>
                            {Object.keys(PRESET_GRADIENTS).map((key) => {
                                const themeKey = key as keyof typeof PRESET_GRADIENTS;
                                return (
                                    <TouchableOpacity
                                        key={themeKey}
                                        style={[
                                            styles.themeCircle,
                                            { backgroundColor: PRESET_GRADIENTS[themeKey][1] },
                                            selectedTheme === themeKey && styles.themeCircleActive
                                        ]}
                                        onPress={() => {
                                            setSelectedTheme(themeKey);
                                            selectionFeedback();
                                        }}
                                    />
                                )
                            })}
                        </View>
                    </Animated.View>
                );
            case 4: // COMMIT
                return (
                    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.stepContainer}>
                        <Ionicons name="trophy" size={64} color="white" style={{ marginBottom: 24 }} />
                        <Text style={styles.summaryTitle}>{name}</Text>
                        {why ? <Text style={styles.summaryWhy}>"{why}"</Text> : null}
                        <Text style={styles.summaryDate}>by {targetDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>

                        <View style={styles.commitArea}>
                            <Text style={styles.commitText}>Hold to Commit</Text>
                            <TouchableOpacity
                                activeOpacity={1}
                                onPressIn={startHold}
                                onPressOut={stopHold}
                                style={styles.holdButton}
                            >
                                <Animated.View style={[styles.holdFill, holdStyle]} />
                                <Ionicons name="finger-print" size={48} color="rgba(255,255,255,0.3)" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                );
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={{ flex: 1 }}>
                    <LinearGradient
                        colors={PRESET_GRADIENTS[selectedTheme] as any}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <View style={styles.progressBar}>
                            <Animated.View style={[styles.progressFill, { width: `${(step + 1) / STEPS.length * 100}%` }]} />
                        </View>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Content */}
                    {/* Content */}
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {renderStepContent()}
                        </ScrollView>
                    </TouchableWithoutFeedback>

                    {/* Footer Navigation (Except last step) */}
                    {step < STEPS.length - 1 && (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
                        >
                            <View style={styles.footer}>
                                <TouchableOpacity
                                    onPress={handleNext}
                                    disabled={step === 0 && name.length === 0}
                                    style={[styles.nextButton, (step === 0 && name.length === 0) && styles.nextButtonDisabled]}
                                >
                                    <Text style={styles.nextButtonText}>{step === 0 ? 'Start' : 'Next'}</Text>
                                    <Ionicons name="arrow-forward" size={20} color="white" />
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal >
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    iconButton: {
        padding: 8,
    },
    progressBar: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        marginHorizontal: 20,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: 'white',
        borderRadius: 2,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 30,
        paddingBottom: 100, // Extra padding to ensure content isn't hidden behind footer
    },
    stepContainer: {
        alignItems: 'center',
        width: '100%',
    },
    question: {
        fontSize: 32,
        fontWeight: '800',
        color: 'white',
        textAlign: 'center',
        marginBottom: 40,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    mainInput: {
        fontSize: 32,
        color: 'white',
        textAlign: 'center',
        width: '100%',
        borderBottomWidth: 2,
        borderBottomColor: 'rgba(255,255,255,0.2)',
        paddingBottom: 10,
        fontWeight: '600',
        fontFamily: 'SpaceMono-Regular',
    },
    helper: {
        marginTop: 20,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontFamily: 'SpaceMono-Regular',
    },
    datePickerContainer: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    footer: {
        padding: 40,
        alignItems: 'flex-end',
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 40,
        gap: 8,
    },
    nextButtonDisabled: {
        opacity: 0.5,
    },
    nextButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        fontFamily: 'SpaceMono-Regular',
        letterSpacing: 1,
    },

    // Category Styles
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
    },
    catChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    catChipActive: {
        backgroundColor: 'white',
    },
    catText: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        fontFamily: 'SpaceMono-Regular',
    },
    catTextActive: {
        color: '#0f172a',
    },
    label: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 16,
        alignSelf: 'flex-start',
        marginLeft: 4,
        fontFamily: 'SpaceMono-Regular',
        letterSpacing: 1,
    },
    themeGrid: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 8,
    },
    themeCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    themeCircleActive: {
        borderColor: 'white',
        transform: [{ scale: 1.1 }],
    },

    // Summary
    summaryTitle: {
        fontSize: 40,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        marginBottom: 8,
        fontFamily: 'SpaceGrotesk-Bold',
        letterSpacing: -1,
    },
    summaryWhy: {
        fontSize: 18,
        fontStyle: 'italic',
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
        fontFamily: 'SpaceMono-Regular',
    },
    summaryDate: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 60,
        fontFamily: 'SpaceMono-Regular',
    },
    commitArea: {
        alignItems: 'center',
        gap: 20,
    },
    commitText: {
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'SpaceMono-Regular',
    },
    holdButton: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    holdFill: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        height: '100%',
    },
});
