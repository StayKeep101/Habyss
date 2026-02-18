import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useRoutines, Routine } from '@/constants/RoutineContext';
import { RoutineBuilder } from '@/components/Routine/RoutineBuilder';
import { RoutinePlayer } from '@/components/Routine/RoutinePlayer';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import Animated, { FadeInDown } from 'react-native-reanimated';

// ============================================
// Routine Detail Screen
// View, edit, or create routines
// ============================================

export default function RoutineDetailScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { id, mode: initialMode } = useLocalSearchParams<{ id?: string; mode?: string }>();
    const { routines, startRoutine, deleteRoutine, isRoutineRunning, activeRoutine } = useRoutines();

    const [viewMode, setViewMode] = useState<'view' | 'edit' | 'create' | 'playing'>(
        initialMode === 'create' ? 'create' : 'view'
    );

    const routine = id ? routines.find(r => r.id === id) : undefined;

    // If a routine is actively running, show the player
    useEffect(() => {
        if (isRoutineRunning && activeRoutine) {
            setViewMode('playing');
        }
    }, [isRoutineRunning]);

    const handleStart = async () => {
        if (!routine) return;
        await startRoutine(routine);
        setViewMode('playing');
    };

    const handleDelete = () => {
        if (!routine) return;
        Alert.alert(
            'Delete Routine',
            `Are you sure you want to delete "${routine.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteRoutine(routine.id);
                        router.back();
                    },
                },
            ]
        );
    };

    // ============================================
    // Player Mode
    // ============================================
    if (viewMode === 'playing') {
        return <RoutinePlayer onClose={() => {
            setViewMode('view');
            router.back();
        }} />;
    }

    // ============================================
    // Create / Edit Mode
    // ============================================
    if (viewMode === 'create' || viewMode === 'edit') {
        return (
            <VoidShell>
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => viewMode === 'create' ? router.back() : setViewMode('view')}>
                            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                            {viewMode === 'create' ? 'New Routine' : 'Edit Routine'}
                        </Text>
                        <View style={{ width: 22 }} />
                    </View>
                    <RoutineBuilder
                        routineId={viewMode === 'edit' ? id : undefined}
                        onSave={() => {
                            if (viewMode === 'create') {
                                router.back();
                            } else {
                                setViewMode('view');
                            }
                        }}
                        onCancel={() => {
                            if (viewMode === 'create') {
                                router.back();
                            } else {
                                setViewMode('view');
                            }
                        }}
                    />
                </SafeAreaView>
            </VoidShell>
        );
    }

    // ============================================
    // View Mode
    // ============================================
    if (!routine) {
        return (
            <VoidShell>
                <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary }}>Routine not found</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                        <Text style={{ color: colors.primary }}>Go back</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </VoidShell>
        );
    }

    const totalMinutes = Math.round(
        routine.habits.reduce((sum, h) => sum + h.focusDuration, 0) / 60
    );

    const timeLabel = {
        morning: '☀️ Morning',
        afternoon: '🌤️ Afternoon',
        evening: '🌙 Evening',
        anytime: '⏰ Anytime',
    }[routine.timeOfDay] || routine.timeOfDay;

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity onPress={() => setViewMode('edit')}>
                            <Ionicons name="pencil" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDelete}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                    {/* Routine Info */}
                    <Animated.View entering={FadeInDown.delay(100)} style={styles.infoSection}>
                        <Text style={styles.routineEmoji}>{routine.emoji}</Text>
                        <Text style={[styles.routineName, { color: colors.textPrimary }]}>
                            {routine.name}
                        </Text>
                        <View style={styles.metaRow}>
                            <View style={[styles.metaPill, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                                    {timeLabel}
                                </Text>
                            </View>
                            <View style={[styles.metaPill, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                                    {routine.habits.length} habits
                                </Text>
                            </View>
                            <View style={[styles.metaPill, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                                    {totalMinutes} min
                                </Text>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Habits List */}
                    <View style={styles.habitsSection}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                            SEQUENCE
                        </Text>
                        {routine.habits.map((h, i) => (
                            <Animated.View
                                key={h.id}
                                entering={FadeInDown.delay(200 + i * 80)}
                            >
                                <VoidCard glass style={styles.habitItem}>
                                    <View style={[styles.positionBadge, { backgroundColor: colors.primary + '20' }]}>
                                        <Text style={[styles.positionText, { color: colors.primary }]}>
                                            {i + 1}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 22, marginRight: 10 }}>{h.habitEmoji}</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.habitName, { color: colors.textPrimary }]}>
                                            {h.habitName}
                                        </Text>
                                        <Text style={[styles.habitMeta, { color: colors.textTertiary }]}>
                                            {h.timerMode.replace('_', ' ')} · {Math.round(h.focusDuration / 60)} min
                                        </Text>
                                    </View>
                                </VoidCard>
                                {/* Connector line */}
                                {i < routine.habits.length - 1 && (
                                    <View style={styles.connector}>
                                        <View style={[styles.connectorLine, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
                                    </View>
                                )}
                            </Animated.View>
                        ))}
                    </View>
                </ScrollView>

                {/* Start Button */}
                <View style={styles.bottomBar}>
                    <TouchableOpacity
                        onPress={handleStart}
                        disabled={isRoutineRunning}
                        style={[styles.startButton, {
                            backgroundColor: colors.primary,
                            opacity: isRoutineRunning ? 0.5 : 1,
                        }]}
                    >
                        <Ionicons name="play" size={20} color="#000" />
                        <Text style={styles.startButtonText}>Start Routine</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 16,
        fontFamily: 'Lexend',
        fontWeight: '600',
    },
    infoSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    routineEmoji: {
        fontSize: 56,
        marginBottom: 12,
    },
    routineName: {
        fontSize: 24,
        fontFamily: 'Lexend',
        fontWeight: '800',
        marginBottom: 12,
    },
    metaRow: {
        flexDirection: 'row',
        gap: 8,
    },
    metaPill: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    metaText: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
    },
    habitsSection: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 2,
        marginBottom: 12,
    },
    habitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    positionBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    positionText: {
        fontSize: 11,
        fontFamily: 'Lexend',
        fontWeight: '700',
    },
    habitName: {
        fontSize: 14,
        fontFamily: 'Lexend',
        fontWeight: '600',
    },
    habitMeta: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    connector: {
        alignItems: 'center',
        height: 20,
    },
    connectorLine: {
        width: 2,
        height: 20,
        borderRadius: 1,
    },
    bottomBar: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        paddingBottom: 24,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    startButtonText: {
        color: '#000',
        fontSize: 16,
        fontFamily: 'Lexend',
        fontWeight: '700',
    },
});
