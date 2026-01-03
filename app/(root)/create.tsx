import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Keyboard, DeviceEventEmitter, Alert, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import Animated, { FadeIn, SlideInRight, SlideOutLeft, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { addHabit, updateHabit, HabitCategory, HabitType, subscribeToHabits, Habit } from '@/lib/habits';

// Step Components
import { StepEssence } from '@/components/RitualForge/StepEssence';
import { StepRhythm } from '@/components/RitualForge/StepRhythm';
import { StepIdentity } from '@/components/RitualForge/StepIdentity';

const TOTAL_STEPS = 3;

export default function RitualForgeScreen() {
    const router = useRouter();
    const params = useGlobalSearchParams();
    const { theme } = useTheme();
    const colors = Colors[theme];

    // --- State ---
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);

    // Data State
    const [name, setName] = useState(params.name as string || '');
    const [description, setDescription] = useState(params.description as string || '');
    const [taskDays, setTaskDays] = useState<string[]>(params.taskDays ? JSON.parse(params.taskDays as string) : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    const [time, setTime] = useState(params.startTime ? new Date(`1970-01-01T${params.startTime}:00`) : new Date());
    const [icon, setIcon] = useState(params.icon as string || 'fitness');
    const [color, setColor] = useState(params.color as string || '#3B82F6');
    const [category, setCategory] = useState<HabitCategory>((params.category as HabitCategory) || 'personal');
    const [type, setType] = useState<HabitType>((params.type as HabitType) || 'build');

    // Goal-related state
    const [isGoal, setIsGoal] = useState(params.isGoal === 'true');
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(params.goalId as string || null);
    const [goals, setGoals] = useState<Habit[]>([]);
    const [showGoalPicker, setShowGoalPicker] = useState(false);

    const isEditing = !!params.id;

    // Load available goals for linking habits
    useEffect(() => {
        const unsubPromise = subscribeToHabits((allHabits) => {
            setGoals(allHabits.filter(h => h.isGoal));
        });
        return () => { unsubPromise.then(unsub => unsub()); };
    }, []);

    // --- Actions ---

    const handleNext = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Keyboard.dismiss();
        if (step < TOTAL_STEPS - 1) {
            setStep(step + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Keyboard.dismiss();
        if (step > 0) {
            setStep(step - 1);
        } else {
            router.back();
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) return;
        setSaving(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            // Format Data
            const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

            const habitData = {
                name: name.trim(),
                description: description.trim(),
                type,
                icon,
                color,
                category,
                goalValue: 1, // Default for now
                unit: 'count', // Default
                goalPeriod: 'daily' as 'daily' | 'weekly' | 'monthly', // Default
                startTime: fmtTime(time),
                taskDays,
                startDate: new Date().toISOString(),
                isArchived: false,
                reminders: [],
                chartType: 'bar',
                showMemo: false,
                isGoal: isGoal,
                goalId: selectedGoalId || undefined,
            };

            if (isEditing) {
                await updateHabit({
                    id: params.id as string,
                    ...habitData
                });
            } else {
                await addHabit(habitData);
            }

            DeviceEventEmitter.emit('habit_created');
            router.back();

        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to save ritual.");
            setSaving(false);
        }
    };

    const updateData = (data: any) => {
        if (data.name !== undefined) setName(data.name);
        if (data.description !== undefined) setDescription(data.description);
        if (data.days !== undefined) setTaskDays(data.days);
        if (data.time !== undefined) setTime(data.time);
        if (data.icon !== undefined) setIcon(data.icon);
        if (data.color !== undefined) setColor(data.color);
        if (data.category !== undefined) setCategory(data.category);
    };

    // --- Render ---

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <StepEssence
                        name={name}
                        description={description}
                        onUpdate={updateData}
                        onSubmit={handleNext}
                        colors={colors}
                    />
                );
            case 1:
                return (
                    <StepRhythm
                        days={taskDays}
                        time={time}
                        onUpdate={updateData}
                        colors={colors}
                    />
                );
            case 2:
                return (
                    <StepIdentity
                        icon={icon}
                        color={color}
                        category={category}
                        onUpdate={updateData}
                        colors={colors}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <Animated.View
                            layout={Layout.springify()}
                            style={[
                                styles.progressFill,
                                {
                                    width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
                                    backgroundColor: color
                                }
                            ]}
                        />
                    </View>
                </View>
                <View style={styles.headerBtn} />
            </View>

            {/* Content */}
            <View style={styles.content}>
                {renderStep()}
            </View>

            {/* Goal Link Section - Only show when creating a habit (not a goal) */}
            {!isGoal && step === 2 && (
                <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceMono-Regular', letterSpacing: 1, marginBottom: 8 }}>
                        LINK TO GOAL (OPTIONAL)
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowGoalPicker(true)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: colors.surfaceSecondary,
                            borderRadius: 16,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: selectedGoalId ? color : colors.border,
                        }}
                    >
                        <Ionicons
                            name={selectedGoalId ? "flag" : "flag-outline"}
                            size={20}
                            color={selectedGoalId ? color : colors.textSecondary}
                        />
                        <Text style={{
                            flex: 1,
                            marginLeft: 12,
                            color: selectedGoalId ? colors.textPrimary : colors.textTertiary,
                            fontSize: 16,
                        }}>
                            {selectedGoalId
                                ? goals.find(g => g.id === selectedGoalId)?.name || 'Selected Goal'
                                : 'Select a goal to link this habit to'}
                        </Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    {selectedGoalId && (
                        <TouchableOpacity
                            onPress={() => setSelectedGoalId(null)}
                            style={{ marginTop: 8, alignSelf: 'flex-end' }}
                        >
                            <Text style={{ color: colors.error, fontSize: 12 }}>Remove link</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity
                    onPress={handleNext}
                    disabled={step === 0 && !name.trim()}
                    style={[
                        styles.nextBtn,
                        { backgroundColor: step === 0 && !name.trim() ? colors.surfaceSecondary : color }
                    ]}
                >
                    <Text style={[
                        styles.nextBtnText,
                        { color: step === 0 && !name.trim() ? colors.textTertiary : 'white' }
                    ]}>
                        {step === TOTAL_STEPS - 1 ? (isEditing ? 'Save' : isGoal ? 'Create Goal' : 'Create Habit') : 'Continue'}
                    </Text>
                    {step < TOTAL_STEPS - 1 && <Ionicons name="arrow-forward" size={20} color="white" />}
                </TouchableOpacity>
            </View>

            {/* Goal Picker Modal */}
            <Modal
                visible={showGoalPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowGoalPicker(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', fontFamily: 'SpaceGrotesk-Bold' }}>Link to Goal</Text>
                            <TouchableOpacity onPress={() => setShowGoalPicker(false)}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ padding: 20 }}>
                            {goals.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                    <Ionicons name="flag-outline" size={48} color={colors.textTertiary} />
                                    <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16 }}>No goals yet</Text>
                                    <Text style={{ color: colors.textTertiary, marginTop: 4, fontSize: 12, textAlign: 'center' }}>Create a goal first to link habits to it</Text>
                                </View>
                            ) : (
                                goals.map(goal => (
                                    <TouchableOpacity
                                        key={goal.id}
                                        onPress={() => {
                                            setSelectedGoalId(goal.id);
                                            setShowGoalPicker(false);
                                            Haptics.selectionAsync();
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 16,
                                            borderRadius: 12,
                                            marginBottom: 12,
                                            backgroundColor: selectedGoalId === goal.id ? color + '20' : colors.surfaceSecondary,
                                            borderWidth: 1,
                                            borderColor: selectedGoalId === goal.id ? color : 'transparent',
                                        }}
                                    >
                                        <Ionicons name={(goal.icon as any) || 'flag'} size={24} color={goal.color || color} />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{goal.name}</Text>
                                            {goal.targetDate && (
                                                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                                                    Target: {new Date(goal.targetDate).toLocaleDateString()}
                                                </Text>
                                            )}
                                        </View>
                                        {selectedGoalId === goal.id && (
                                            <Ionicons name="checkmark-circle" size={24} color={color} />
                                        )}
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        height: 60,
    },
    headerBtn: {
        width: 40,
        alignItems: 'flex-start',
    },
    progressContainer: {
        flex: 1,
        alignItems: 'center',
    },
    progressBar: {
        width: 100,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    content: {
        flex: 1,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    nextBtn: {
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    nextBtnText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
});
