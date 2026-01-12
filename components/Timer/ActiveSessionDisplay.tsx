import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useAccentGradient } from '@/constants/AccentContext';

interface ActiveSessionDisplayProps {
    timeLeft: number;
    totalDuration: number;
    habitName: string | null;
    isPaused: boolean;
    isRunning: boolean;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    colors: any;
    isLight: boolean;
    dailyAverage?: number;
    monthlyAverage?: number;
    yearlyAverage?: number;
}

export const ActiveSessionDisplay: React.FC<ActiveSessionDisplayProps> = ({
    timeLeft,
    totalDuration,
    habitName,
    isPaused,
    isRunning,
    onPause,
    onResume,
    onStop,
    colors,
    isLight,
    dailyAverage,
    monthlyAverage,
    yearlyAverage
}) => {
    const { colors: accentColors, primary: accentColor } = useAccentGradient();

    const formatCountdown = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${hours}h ${mins}m`;
        if (mins > 0) return `${mins}m`;
        return `${secs}s`;
    };

    // Timer progress calculation - starts at 12 o'clock
    const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0;
    const circumference = 2 * Math.PI * 38; // radius = 38
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <View style={styles.activeTimerSection}>
            {/* Circular Timer */}
            <View style={styles.timerRingContainer}>
                <Svg width={100} height={100} style={styles.timerRing}>
                    {/* Background Circle */}
                    <Circle
                        cx={50}
                        cy={50}
                        r={38}
                        stroke={isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}
                        strokeWidth="6"
                        fill="transparent"
                    />
                    {/* Progress Circle - starts at 12 o'clock (rotated -90deg) */}
                    <Circle
                        cx={50}
                        cy={50}
                        r={38}
                        stroke={accentColor}
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                    />
                </Svg>
                <View style={styles.timerContent}>
                    <Text style={[styles.countdownText, { color: colors.textPrimary }]}>
                        {formatCountdown(timeLeft)}
                    </Text>
                </View>
            </View>

            {/* Timer Info & Controls */}
            <View style={styles.timerInfo}>
                <View>
                    <Text style={[styles.habitName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {habitName || 'Focus'}
                    </Text>
                    <Text style={[styles.statusText, { color: isPaused ? colors.textTertiary : accentColor }]}>
                        {isPaused ? 'PAUSED' : 'FOCUSING'}
                    </Text>
                </View>

                {/* Control Buttons */}
                <View style={styles.controlButtons}>
                    <TouchableOpacity
                        onPress={onStop}
                        style={[styles.controlBtn, { borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)' }]}
                    >
                        <Ionicons name="stop" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={isRunning ? onPause : onResume} activeOpacity={0.8}>
                        <LinearGradient
                            colors={accentColors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.playPauseBtn}
                        >
                            <Ionicons
                                name={isRunning ? 'pause' : 'play'}
                                size={20}
                                color="#fff"
                                style={isRunning ? {} : { marginLeft: 2 }}
                            />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Stats Column - optional if passed */}
            {(dailyAverage !== undefined || monthlyAverage !== undefined || yearlyAverage !== undefined) && (
                <View style={styles.statsColumn}>
                    {dailyAverage !== undefined && (
                        <View style={styles.statItemVertical}>
                            <Text style={[styles.statValueSmall, { color: colors.textPrimary }]}>
                                {formatTime(dailyAverage)}
                            </Text>
                            <Text style={[styles.statLabelSmall, { color: colors.textTertiary }]}>Daily Avg</Text>
                        </View>
                    )}
                    {dailyAverage !== undefined && monthlyAverage !== undefined && (
                        <View style={[styles.statDividerH, { backgroundColor: colors.border }]} />
                    )}
                    {monthlyAverage !== undefined && (
                        <View style={styles.statItemVertical}>
                            <Text style={[styles.statValueSmall, { color: colors.textPrimary }]}>
                                {formatTime(monthlyAverage)}
                            </Text>
                            <Text style={[styles.statLabelSmall, { color: colors.textTertiary }]}>Monthly Avg</Text>
                        </View>
                    )}
                    {monthlyAverage !== undefined && yearlyAverage !== undefined && (
                        <View style={[styles.statDividerH, { backgroundColor: colors.border }]} />
                    )}
                    {yearlyAverage !== undefined && (
                        <View style={styles.statItemVertical}>
                            <Text style={[styles.statValueSmall, { color: colors.textPrimary }]}>
                                {formatTime(yearlyAverage)}
                            </Text>
                            <Text style={[styles.statLabelSmall, { color: colors.textTertiary }]}>Yearly Avg</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    activeTimerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        width: '100%',
    },
    timerRingContainer: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerRing: {
        position: 'absolute',
    },
    timerContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    countdownText: {
        fontSize: 18,
        fontWeight: '800',
        fontFamily: 'Lexend',
        letterSpacing: -0.5,
    },
    timerInfo: {
        flex: 1,
        gap: 12,
        justifyContent: 'center',
    },
    habitName: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    controlButtons: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    controlBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playPauseBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsColumn: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 4,
        paddingLeft: 16,
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(128,128,128,0.1)',
    },
    statItemVertical: {
        alignItems: 'flex-end',
    },
    statValueSmall: {
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    statLabelSmall: {
        fontSize: 8,
        fontFamily: 'Lexend_400Regular',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.7,
    },
    statDividerH: {
        width: 32,
        height: 1,
        marginVertical: 2,
        opacity: 0.3,
    },
});
