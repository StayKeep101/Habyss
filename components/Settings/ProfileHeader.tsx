import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getHabits, getCompletions, Habit, getUserId } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';

import { CommandCenter } from '@/components/CommandCenter';

export const ProfileHeader = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState({
        activeHabits: 0,
        completionRate: 0,
        level: 'Novice'
    });
    const [loading, setLoading] = useState(true);
    const [showCommandCenter, setShowCommandCenter] = useState(false);
    const { lightFeedback } = useHaptics();

    useEffect(() => {
        loadProfileData();
    }, []);

    const loadProfileData = async () => {
        try {
            // 1. Get User
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            // 2. Get Habits Stats
            const habits = await getHabits();
            const activeHabits = habits.length;

            // 3. Calculate Today's Completion Rate
            const todayStr = new Date().toISOString().split('T')[0];
            const completions = await getCompletions(todayStr);
            const completedCount = Object.values(completions).filter(v => v).length;
            const rate = activeHabits > 0 ? Math.round((completedCount / activeHabits) * 100) : 0;

            // 4. Determine Level/Title
            let level = 'Novice';
            if (activeHabits >= 3) level = 'Apprentice';
            if (activeHabits >= 5) level = 'Habit Builder';
            if (activeHabits >= 10) level = 'Master Of Routine';
            if (activeHabits >= 20) level = 'Grandmaster';

            setStats({
                activeHabits,
                completionRate: rate,
                level
            });
        } catch (e) {
            console.error("Error loading profile:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    return (
        <>
            <TouchableOpacity
                style={styles.container}
                onPress={() => {
                    lightFeedback();
                    setShowCommandCenter(true);
                }}
                activeOpacity={0.9}
            >
                <LinearGradient
                    colors={[colors.primary, '#4c1d95']} // Dynamic purple gradient
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.card}
                >
                    <View style={styles.content}>
                        <View style={styles.row}>
                            {/* Avatar / Placeholder */}
                            <View style={styles.avatarContainer}>
                                <Text style={styles.avatarText}>
                                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                                </Text>
                            </View>

                            <View style={styles.userInfo}>
                                <Text style={styles.levelLabel}>{stats.level}</Text>
                                <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
                            </View>

                            <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.6)" />
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{stats.activeHabits}</Text>
                                <Text style={styles.statLabel}>Active Habits</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{stats.completionRate}%</Text>
                                <Text style={styles.statLabel}>Today's Focus</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>

            <CommandCenter
                visible={showCommandCenter}
                onClose={() => setShowCommandCenter(false)}
                user={user}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    loadingContainer: {
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        padding: 24,
    },
    content: {
        gap: 24,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    avatarContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
    userInfo: {
        flex: 1,
        marginLeft: 16,
    },
    levelLabel: {
        color: '#fbbf24', // Amber-400
        fontWeight: '800',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    email: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 16,
        padding: 16,
        justifyContent: 'space-between',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    divider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    statValue: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
});
