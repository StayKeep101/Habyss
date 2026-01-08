import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Keyboard, DeviceEventEmitter, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useAccentGradient } from '@/constants/AccentContext';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { useHaptics } from '@/hooks/useHaptics';
import DateTimePicker from '@react-native-community/datetimepicker';

import { addHabit, getHabits, updateHabit } from '@/lib/habits';

// Simple 2-step Goal Creation/Edit Wizard
// Step 1: Name + Description
// Step 2: Target Date

export default function GoalCreationWizard() {
    const router = useRouter();
    const params = useGlobalSearchParams();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    // Check if editing existing goal
    const editId = params.id as string | undefined;
    const isEditing = !!editId;

    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEditing);

    // Form State
    const [name, setName] = useState((params.name as string) || '');
    const [description, setDescription] = useState((params.description as string) || '');
    const [targetDate, setTargetDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // +30 days
    const [icon, setIcon] = useState((params.icon as string) || 'flag');
    const [color, setColor] = useState(accentColor);
    const [category, setCategory] = useState((params.category as string) || 'personal');

    const totalSteps = 2;

    // Load existing goal data if editing
    useEffect(() => {
        if (isEditing) {
            const loadGoal = async () => {
                try {
                    const habits = await getHabits();
                    const goal = habits.find(h => h.id === editId);
                    if (goal) {
                        setName(goal.name || '');
                        setDescription(goal.description || '');
                        setIcon(goal.icon || 'flag');
                        setColor(goal.color || accentColor);
                        setCategory(goal.category || 'personal');
                        if (goal.targetDate) {
                            setTargetDate(new Date(goal.targetDate));
                        }
                    }
                } catch (e) {
                    console.error('Error loading goal:', e);
                } finally {
                    setLoading(false);
                }
            };
            loadGoal();
        }
    }, [editId, isEditing]);

    const handleNext = () => {
        lightFeedback();
        Keyboard.dismiss();
        if (step < totalSteps - 1) {
            setStep(step + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        lightFeedback();
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
        successFeedback();

        try {
            const fmtDate = (d: Date) => d.toISOString().split('T')[0];

            const goalData = {
                name: name.trim(),
                description: description.trim(),
                type: 'build' as const,
                icon,
                color,
                category: category as any,
                goalValue: 1,
                unit: 'count',
                goalPeriod: 'daily' as const,
                startTime: '09:00',
                taskDays: [] as string[],
                startDate: new Date().toISOString(),
                isArchived: false,
                reminders: [] as string[],
                chartType: 'line' as const,
                showMemo: false,
                isGoal: true,
                targetDate: fmtDate(targetDate),
            };

            if (isEditing && editId) {
                // Update existing goal
                await updateHabit({ id: editId, ...goalData });
            } else {
                // Create new goal
                await addHabit(goalData);
            }

            DeviceEventEmitter.emit('habit_created');
            router.back();

        } catch (e) {
            console.error(e);
            Alert.alert("Error", `Failed to ${isEditing ? 'update' : 'create'} goal.`);
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.textSecondary }}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderStep = () => {
        if (step === 0) {
            return (
                <Animated.View entering={FadeIn} style={styles.stepContainer}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {isEditing ? 'Edit your goal' : 'Name your goal'}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {isEditing ? 'Update your goal details' : 'What do you want to achieve?'}
                    </Text>

                    <TextInput
                        style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                        placeholder="e.g., Run a marathon"
                        placeholderTextColor={colors.textTertiary}
                        value={name}
                        onChangeText={setName}
                        autoFocus={!isEditing}
                        returnKeyType="next"
                    />

                    <TextInput
                        style={[styles.textArea, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                        placeholder="Add a description (optional)"
                        placeholderTextColor={colors.textTertiary}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                    />
                </Animated.View>
            );
        }

        return (
            <Animated.View entering={FadeIn} style={styles.stepContainer}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {isEditing ? 'Update target date' : 'Set your target date'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    When do you want to achieve this?
                </Text>

                <View style={[styles.datePickerContainer, { backgroundColor: colors.surfaceSecondary }]}>
                    <DateTimePicker
                        value={targetDate}
                        mode="date"
                        display="spinner"
                        onChange={(_, date) => date && setTargetDate(date)}
                        minimumDate={new Date()}
                        textColor={colors.textPrimary}
                    />
                </View>

                <View style={[styles.datePreview, { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name="flag" size={24} color={color} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>TARGET</Text>
                        <Text style={[styles.previewDate, { color: colors.textPrimary }]}>
                            {targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </Text>
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.progressContainer}>
                    <Text style={[styles.stepIndicator, { color: colors.textSecondary }]}>
                        {step + 1} / {totalSteps}
                    </Text>
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <Animated.View
                            layout={Layout.springify()}
                            style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%`, backgroundColor: color }]}
                        />
                    </View>
                </View>
                <View style={styles.headerBtn} />
            </View>

            {/* Content with Footer inside for keyboard avoidance */}
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content} keyboardVerticalOffset={10}>
                {renderStep()}

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        onPress={handleNext}
                        disabled={(step === 0 && !name.trim()) || saving}
                        style={[
                            styles.nextBtn,
                            { backgroundColor: (step === 0 && !name.trim()) || saving ? colors.surfaceSecondary : color }
                        ]}
                    >
                        <Text style={[styles.nextBtnText, { color: (step === 0 && !name.trim()) || saving ? colors.textTertiary : '#fff' }]}>
                            {saving ? (isEditing ? 'Saving...' : 'Creating...') : step === totalSteps - 1 ? (isEditing ? 'Save Changes' : 'Create Goal') : 'Continue'}
                        </Text>
                        {step < totalSteps - 1 && !saving && <Ionicons name="arrow-forward" size={20} color="#fff" />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    progressContainer: { flex: 1, alignItems: 'center' },
    stepIndicator: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    progressBar: { width: '80%', height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    content: { flex: 1 },
    stepContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32 },
    input: { fontSize: 18, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
    textArea: { fontSize: 16, padding: 16, borderRadius: 16, borderWidth: 1, minHeight: 100, textAlignVertical: 'top' },
    datePickerContainer: { borderRadius: 20, overflow: 'hidden', marginBottom: 24 },
    datePreview: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16 },
    previewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    previewDate: { fontSize: 16, fontWeight: '600', marginTop: 2 },
    footer: { paddingHorizontal: 24, paddingVertical: 16 },
    nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 16 },
    nextBtnText: { fontSize: 17, fontWeight: '700' },
});
