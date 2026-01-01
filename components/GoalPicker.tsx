import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { subscribeToHabits, Habit } from '@/lib/habits';

interface GoalPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelectGoal: (goalId: string, goalName: string) => void;
    selectedGoalId?: string;
}

export const GoalPicker: React.FC<GoalPickerProps> = ({
    visible,
    onClose,
    onSelectGoal,
    selectedGoalId,
}) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'abyss'];
    const [goals, setGoals] = useState<Habit[]>([]);

    useEffect(() => {
        if (!visible) return;

        const unsubPromise = subscribeToHabits((habits) => {
            // Filter for goals only (habits where isGoal is true and not archived)
            const activeGoals = habits.filter(h => h.isGoal && !h.isArchived);
            setGoals(activeGoals);
        });

        return () => {
            unsubPromise.then(unsub => unsub());
        };
    }, [visible]);

    const handleSelectGoal = (goal: Habit) => {
        onSelectGoal(goal.id, goal.name);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View className="rounded-t-[40px] pb-10" style={{ backgroundColor: colors.background, maxHeight: '70%' }}>
                    {/* Header */}
                    <View className="flex-row justify-between items-center px-6 pt-6 pb-4 border-b" style={{ borderColor: colors.border }}>
                        <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                            Select Goal
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.surfaceSecondary }}
                        >
                            <Ionicons name="close" size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {/* Goals List */}
                    <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false}>
                        {goals.length > 0 ? (
                            goals.map((goal) => (
                                <TouchableOpacity
                                    key={goal.id}
                                    onPress={() => handleSelectGoal(goal)}
                                    className="mb-3 p-4 rounded-2xl border-2 flex-row items-center"
                                    style={{
                                        backgroundColor: selectedGoalId === goal.id ? goal.color + '15' : colors.surfaceSecondary,
                                        borderColor: selectedGoalId === goal.id ? goal.color : colors.border,
                                    }}
                                >
                                    {/* Icon */}
                                    <View
                                        className="w-12 h-12 rounded-full items-center justify-center mr-3"
                                        style={{ backgroundColor: goal.color + '20' }}
                                    >
                                        <Ionicons
                                            name={(goal.icon || 'flag') as any}
                                            size={24}
                                            color={goal.color}
                                        />
                                    </View>

                                    {/* Goal Info */}
                                    <View className="flex-1">
                                        <Text className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                                            {goal.name}
                                        </Text>
                                        {goal.targetDate && (
                                            <Text className="text-xs" style={{ color: colors.textTertiary }}>
                                                Target: {new Date(goal.targetDate).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Selection Indicator */}
                                    {selectedGoalId === goal.id && (
                                        <View
                                            className="w-8 h-8 rounded-full items-center justify-center"
                                            style={{ backgroundColor: goal.color }}
                                        >
                                            <Ionicons name="checkmark" size={18} color="white" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View className="items-center justify-center py-12">
                                <View
                                    className="w-20 h-20 rounded-full items-center justify-center mb-4"
                                    style={{ backgroundColor: colors.surfaceSecondary }}
                                >
                                    <Ionicons name="flag-outline" size={40} color={colors.textTertiary} />
                                </View>
                                <Text className="text-base font-semibold mb-2" style={{ color: colors.textPrimary }}>
                                    No Goals Yet
                                </Text>
                                <Text className="text-sm text-center px-8" style={{ color: colors.textSecondary }}>
                                    Create a goal first from the home screen, then you can link habits to it
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};
