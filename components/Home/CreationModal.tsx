import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { Habit } from '@/lib/habits';

interface CreationModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    onCreateGoal: () => void;
    onCreateHabit: () => void;
    onAddHabitToGoal: (goalId: string) => void;
}

export const CreationModal: React.FC<CreationModalProps> = ({
    visible,
    onClose,
    goals,
    onCreateGoal,
    onCreateHabit,
    onAddHabitToGoal
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.modalContent, { backgroundColor: colors.surface, flex: 1 }]}>

                {/* Handle bar */}
                <View style={styles.handleContainer}>
                    <View style={[styles.handle, { backgroundColor: colors.border }]} />
                </View>

                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Create New</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.optionsContainer}>
                    {/* Main Options: Goal vs Habit */}
                    <View style={styles.row}>
                        <TouchableOpacity
                            style={[styles.bigCard, { backgroundColor: colors.surfaceSecondary }]}
                            onPress={() => {
                                onClose();
                                onCreateGoal();
                            }}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                                <Ionicons name="trophy" size={32} color={colors.primary} />
                            </View>
                            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>New Goal</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Set a big objective</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.bigCard, { backgroundColor: colors.surfaceSecondary }]}
                            onPress={() => {
                                onClose();
                                onCreateHabit();
                            }}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: colors.brandSuccess + '20' }]}>
                                <Ionicons name="sparkles" size={32} color={colors.brandSuccess} />
                            </View>
                            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>New Habit</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Build a routine</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Add to Existing Goal Section */}
                    {goals.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ADD HABIT TO GOAL</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalsScroll}>
                                {goals.map((goal) => (
                                    <TouchableOpacity
                                        key={goal.id}
                                        style={[styles.goalChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                                        onPress={() => {
                                            onClose();
                                            onAddHabitToGoal(goal.id);
                                        }}
                                    >
                                        <View style={[styles.miniIcon, { backgroundColor: (goal.color || colors.primary) + '20' }]}>
                                            <Ionicons
                                                name={(goal.icon as any) || 'trophy'}
                                                size={14}
                                                color={goal.color || colors.primary}
                                            />
                                        </View>
                                        <Text style={[styles.goalText, { color: colors.textPrimary }]} numberOfLines={1}>
                                            {goal.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContent: {
        paddingBottom: 40,
        paddingTop: 16,
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    optionsContainer: {
        paddingHorizontal: 24,
    },
    row: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 32,
    },
    bigCard: {
        flex: 1,
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 12,
        textAlign: 'center',
    },
    section: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    goalsScroll: {
        paddingRight: 24,
        gap: 12,
    },
    goalChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginRight: 8,
    },
    miniIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    goalText: {
        fontSize: 14,
        fontWeight: '500',
        maxWidth: 120,
    }
});
