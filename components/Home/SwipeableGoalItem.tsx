import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit } from '@/lib/habits';
import { useRouter } from 'expo-router';
import { VoidCard } from '@/components/Layout/VoidCard';

interface SwipeableGoalItemProps {
    goal: Habit;
    progress: number;
    linkedHabits: Habit[];
    onEdit: (goal: Habit) => void;
    onDelete: (goal: Habit) => void;
    onHabitPress?: (habit: Habit) => void;
}

const ACTION_WIDTH = 70;

export const SwipeableGoalItem: React.FC<SwipeableGoalItemProps> = ({
    goal, progress, linkedHabits, onEdit, onDelete, onHabitPress
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const swipeableRef = useRef<Swipeable>(null);
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);

    const close = () => swipeableRef.current?.close();

    // Swipe right (left gesture) - Opens goal detail page
    const renderLeftActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const trans = dragX.interpolate({
            inputRange: [0, 50, 100],
            outputRange: [-20, 0, 0],
            extrapolate: 'clamp',
        });

        return (
            <RectButton
                style={[styles.leftAction, { backgroundColor: goal.color || '#8B5CF6' }]}
                onPress={() => {
                    close();
                    router.push({ pathname: '/goal-detail', params: { goalId: goal.id } });
                }}
            >
                <Animated.View style={[styles.actionContent, { transform: [{ translateX: trans }] }]}>
                    <Ionicons name="open-outline" size={20} color="white" />
                    <Text style={styles.actionText}>View</Text>
                </Animated.View>
            </RectButton>
        );
    };

    // Swipe left (right gesture) - Edit, Delete
    const renderRightActions = () => {
        return (
            <View style={styles.rightActionsContainer}>
                <RectButton
                    style={[styles.rightAction, { backgroundColor: '#F59E0B' }]}
                    onPress={() => { close(); onEdit(goal); }}
                >
                    <View style={styles.actionContent}>
                        <Ionicons name="pencil" size={20} color="white" />
                        <Text style={styles.actionText}>Edit</Text>
                    </View>
                </RectButton>
                <RectButton
                    style={[styles.rightAction, { backgroundColor: '#EF4444' }]}
                    onPress={() => { close(); onDelete(goal); }}
                >
                    <View style={styles.actionContent}>
                        <Ionicons name="trash" size={20} color="white" />
                        <Text style={styles.actionText}>Delete</Text>
                    </View>
                </RectButton>
            </View>
        );
    };

    return (
        <View style={styles.wrapper}>
            <Swipeable
                ref={swipeableRef}
                renderLeftActions={renderLeftActions}
                renderRightActions={renderRightActions}
                leftThreshold={50}
                rightThreshold={40}
                overshootLeft={false}
                overshootRight={false}
                friction={2}
                containerStyle={styles.swipeableContainer}
            >
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setExpanded(!expanded)}
                    style={[styles.cardWrapper, { backgroundColor: isLight ? colors.surfaceSecondary : '#0a0d14' }]}
                >
                    <View style={[styles.card, {
                        borderColor: (goal.color || '#8B5CF6') + '30',
                        backgroundColor: isLight ? colors.surface : 'rgba(255,255,255,0.02)'
                    }]}>
                        <View style={[styles.iconContainer, { backgroundColor: (goal.color || '#8B5CF6') + '15' }]}>
                            <Ionicons name={(goal.icon as any) || 'flag'} size={18} color={goal.color || '#8B5CF6'} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{goal.name}</Text>
                            <View style={styles.progressRow}>
                                <View style={[styles.progressBar, { backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]}>
                                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: goal.color || '#8B5CF6' }]} />
                                </View>
                                <Text style={[styles.progressText, { color: goal.color || '#8B5CF6' }]}>{progress}%</Text>
                            </View>
                        </View>
                        <View style={styles.habitCount}>
                            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
                            <Text style={[styles.habitCountText, { color: colors.textTertiary }]}>{linkedHabits.length}</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Swipeable>

            {/* Expanded Habits List */}
            {expanded && linkedHabits.length > 0 && (
                <View style={[styles.habitsContainer, { borderLeftColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)' }]}>
                    {linkedHabits.map(habit => (
                        <TouchableOpacity
                            key={habit.id}
                            onPress={() => onHabitPress?.(habit)}
                            style={styles.habitRow}
                        >
                            <View style={[styles.habitDot, { backgroundColor: (habit as any).completed ? colors.success : (isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)') }]} />
                            <Text style={[styles.habitName, { color: colors.textSecondary }, (habit as any).completed && { textDecorationLine: 'line-through', opacity: 0.6 }]} numberOfLines={1}>
                                {habit.name}
                            </Text>
                            {(habit as any).completed && <Ionicons name="checkmark" size={14} color={colors.success} />}
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 8,
    },
    swipeableContainer: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    cardWrapper: {
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    progressBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 12,
        fontWeight: 'bold',
        width: 36,
        textAlign: 'right',
    },
    habitCount: {
        alignItems: 'center',
        marginLeft: 10,
    },
    habitCountText: {
        fontSize: 10,
        marginTop: 2,
    },
    leftAction: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 24,
        borderTopLeftRadius: 14,
        borderBottomLeftRadius: 14,
    },
    rightActionsContainer: {
        flexDirection: 'row',
    },
    rightAction: {
        width: ACTION_WIDTH,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
    },
    habitsContainer: {
        marginTop: 4,
        marginLeft: 54,
        paddingLeft: 14,
        borderLeftWidth: 2,
    },
    habitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingRight: 14,
        gap: 10,
    },
    habitDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    habitName: {
        flex: 1,
        fontSize: 13,
    },
});
