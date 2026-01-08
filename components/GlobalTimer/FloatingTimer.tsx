import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTimer } from '@/contexts/TimerContext';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export const FloatingTimer = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { timerState, pauseTimer, resumeTimer, stopTimer } = useTimer();

    // Hide on habit detail page if it's the ACTIVE habit (because the big timer is there)
    // Or hide always on habit detail? User said: "When you start a timer and you go away from the habit page it will appear"
    // So if we are on the habit detail page of the CURRENT habit, hide this floating bar.
    const isCurrentHabitPage = pathname.includes('/habit-detail') &&
        // How to check params? pathname usually doesn't include query params in some routers
        // simpler check: if we are on habit-detail, we might hide it, 
        // BUT checking the specific ID is harder without parsing params.
        // Let's assume for now we hide it on ALL habit-detail pages to avoid clutter,
        // or ideally only the matching one.
        // Given the mock ups usually show full screen timer, let's hide on habit detail.
        true;

    if (timerState.status === 'idle' || isCurrentHabitPage) {
        return null;
    }

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const isBreak = timerState.status === 'break' || timerState.status === 'longBreak';
    const primaryColor = isBreak ? '#10B981' : colors.primary;

    const handlePress = () => {
        // Navigate to the habit detail
        if (timerState.habitId) {
            router.push({
                pathname: '/(root)/habit-detail',
                params: { habitId: timerState.habitId }
            });
        }
    };

    return (
        <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
        >
            <TouchableOpacity onPress={handlePress} style={styles.content} activeOpacity={0.9}>
                <View style={styles.left}>
                    <View style={[styles.icon, { backgroundColor: primaryColor + '20' }]}>
                        <Ionicons name={isBreak ? "cafe" : "timer"} size={16} color={primaryColor} />
                    </View>
                    <View>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                            {isBreak ? 'Break Time' : 'Focusing...'}
                        </Text>
                        <Text style={[styles.habitName, { color: colors.textPrimary }]}>
                            {timerState.habitName || 'Habit'}
                        </Text>
                    </View>
                </View>

                <View style={styles.right}>
                    <Text style={[styles.time, { color: primaryColor }]}>
                        {formatTime(timerState.timeLeft)}
                    </Text>

                    <TouchableOpacity
                        onPress={timerState.status === 'paused' ? resumeTimer : pauseTimer}
                        style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Ionicons
                            name={timerState.status === 'paused' ? "play" : "pause"}
                            size={18}
                            color={colors.textPrimary}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={stopTimer}
                        style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, marginLeft: 8 }]}
                    >
                        <Ionicons name="stop" size={18} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Progress Bar Line */}
            <View style={[styles.progressBarBase, { backgroundColor: colors.surfaceSecondary }]}>
                <View
                    style={[
                        styles.progressBarFill,
                        {
                            width: `${((timerState.totalTime - timerState.timeLeft) / timerState.totalTime) * 100}%`,
                            backgroundColor: primaryColor
                        }
                    ]}
                />
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 85, // Above Tab Bar used in Expo Router Tabs? 
        // Wait, tabs usually have height ~50-80. 
        // If we put it absolute bottom, it might cover tabs.
        // It should probably be part of the layout ABOVE the tabs, or floating ON TOP.
        // User requested "Live notification" style.
        // Let's try putting it just above the tab bar. 
        // Standard tab bar is ~80px height on iPhone with Safe Area.
        left: 12,
        right: 12,
        borderRadius: 16,
        height: 64,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden',
        borderWidth: 1,
        flexDirection: 'column',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    icon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        fontFamily: 'Lexend_400Regular',
    },
    habitName: {
        fontSize: 13,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    time: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Lexend',
        fontVariant: ['tabular-nums'],
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressBarBase: {
        height: 3,
        width: '100%',
    },
    progressBarFill: {
        height: '100%',
    },
});
