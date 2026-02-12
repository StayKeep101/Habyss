import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Habit, isHabitScheduledForDate } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';
import { useAccentGradient } from '@/constants/AccentContext';
import { SwipeableHabitItem } from './SwipeableHabitItem';
import { useRouter } from 'expo-router';

interface CompletionModalProps {
    visible: boolean;
    onClose: () => void;
    habits: Habit[];
    completions: Record<string, boolean>;
    onToggle: (habitId: string) => void;
    onEdit?: (habit: Habit) => void;
    onDelete?: (habit: Habit) => void;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
    visible,
    onClose,
    habits,
    completions,
    onToggle,
    onEdit,
    onDelete
}) => {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accentColor } = useAccentGradient();
    const [showShare, setShowShare] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

    // Get today's scheduled habits (matching roadmap.tsx filtering)
    const todaysHabits = useMemo(() => {
        const today = new Date();
        return habits.filter(h => !h.isGoal && !h.isArchived && isHabitScheduledForDate(h, today));
    }, [habits]);

    const completedCount = todaysHabits.filter(h => completions[h.id]).length;
    const totalCount = todaysHabits.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const allComplete = completedCount === totalCount && totalCount > 0;

    // Filter habits based on selection
    const filteredHabits = useMemo(() => {
        switch (filter) {
            case 'pending':
                return todaysHabits.filter(h => !completions[h.id]);
            case 'done':
                return todaysHabits.filter(h => completions[h.id]);
            default:
                return todaysHabits;
        }
    }, [todaysHabits, completions, filter]);

    // Group habits by category
    const groupedHabits = useMemo(() => {
        const groups: Record<string, Habit[]> = {};
        filteredHabits.forEach(habit => {
            const cat = habit.category || 'misc';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(habit);
        });
        return groups;
    }, [filteredHabits]);

    const getStatusColor = () => {
        if (allComplete) return '#10B981';
        if (percentage >= 50) return '#FBBF24';
        return accentColor;
    };

    const statusColor = getStatusColor();

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.8}>
            <View style={{ flex: 1 }}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.title, { color: colors.text }]}>TODAY'S HABITS</Text>
                        <Text style={[styles.subtitle, { color: accentColor }]}>COMPLETION STATUS</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowShare(true)} style={[styles.iconButton, { backgroundColor: accentColor + '20' }]}>
                        <Ionicons name="share-social" size={20} color={accentColor} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Main Stats Card */}
                    <VoidCard glass style={styles.mainCard}>
                        <View style={[styles.progressCircle, { borderColor: statusColor }]}>
                            <Text style={[styles.progressValue, { color: statusColor }]}>{percentage}%</Text>
                        </View>
                        <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                            {completedCount} of {totalCount} completed
                        </Text>
                        {allComplete && (
                            <View style={[styles.completeBadge, { backgroundColor: '#10B981' + '20' }]}>
                                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                <Text style={[styles.completeText, { color: '#10B981' }]}>All Done!</Text>
                            </View>
                        )}
                    </VoidCard>

                    {/* Filter Tabs */}
                    <View style={styles.filterRow}>
                        {(['all', 'pending', 'done'] as const).map(f => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setFilter(f)}
                                style={[
                                    styles.filterBtn,
                                    filter === f && { backgroundColor: accentColor + '20', borderColor: accentColor }
                                ]}
                            >
                                <Text style={[
                                    styles.filterText,
                                    { color: filter === f ? accentColor : colors.textTertiary }
                                ]}>
                                    {f === 'all' ? `All (${todaysHabits.length})` :
                                        f === 'pending' ? `Pending (${totalCount - completedCount})` :
                                            `Done (${completedCount})`}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Habits List */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>HABITS</Text>

                    {filteredHabits.length > 0 ? (
                        Object.entries(groupedHabits).map(([category, categoryHabits]) => (
                            <View key={category} style={styles.categoryGroup}>
                                <Text style={[styles.categoryLabel, { color: colors.textTertiary }]}>
                                    {category.toUpperCase()}
                                </Text>
                                {categoryHabits.map(habit => {
                                    return (
                                        <SwipeableHabitItem
                                            key={habit.id}
                                            habit={habit}
                                            completed={!!completions[habit.id]}
                                            onToggle={() => onToggle(habit.id)}
                                            onPress={() => {
                                                onClose();
                                                router.push({
                                                    pathname: '/habit-detail',
                                                    params: { habitId: habit.id }
                                                });
                                            }}
                                            onEdit={onEdit || (() => { })}
                                            onDelete={onDelete || (() => { })}
                                            size="standard"
                                        />
                                    );
                                })}
                            </View>
                        ))
                    ) : (
                        <VoidCard glass style={styles.emptyCard}>
                            <Ionicons
                                name={filter === 'done' ? 'checkmark-done-circle-outline' : 'calendar-outline'}
                                size={40}
                                color={colors.textTertiary}
                            />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                {filter === 'pending' ? 'All habits completed!' :
                                    filter === 'done' ? 'No habits completed yet' :
                                        'No habits scheduled for today'}
                            </Text>
                        </VoidCard>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>

            <ShareStatsModal
                visible={showShare}
                onClose={() => setShowShare(false)}
                stats={{
                    title: "TODAY'S PROGRESS",
                    value: `${percentage}%`,
                    subtitle: `${completedCount}/${totalCount} Habits Completed`,
                    type: 'completion'
                }}
            />
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: 'Lexend'
    },
    subtitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40
    },
    mainCard: {
        alignItems: 'center',
        padding: 24,
        marginBottom: 20
    },
    progressCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 5,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12
    },
    progressValue: {
        fontSize: 28,
        fontWeight: '900',
        fontFamily: 'Lexend'
    },
    progressLabel: {
        fontSize: 13,
        fontFamily: 'Lexend_400Regular'
    },
    completeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginTop: 12
    },
    completeText: {
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'Lexend'
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
        alignItems: 'center'
    },
    filterText: {
        fontSize: 11,
        fontWeight: '600',
        fontFamily: 'Lexend'
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        marginBottom: 12,
        fontFamily: 'Lexend_400Regular'
    },
    categoryGroup: {
        marginBottom: 16
    },
    categoryLabel: {
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        fontFamily: 'Lexend_400Regular'
    },
    habitCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        gap: 12
    },
    habitIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    habitInfo: {
        flex: 1
    },
    habitName: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Lexend'
    },
    habitNameComplete: {
        textDecorationLine: 'line-through',
        opacity: 0.6
    },
    habitDesc: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2
    },
    checkBox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyCard: {
        alignItems: 'center',
        padding: 40,
        gap: 12
    },
    emptyText: {
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center'
    },
});
