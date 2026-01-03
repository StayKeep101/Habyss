import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Friend } from '@/lib/friendsService';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

interface FriendStatsModalProps {
    visible: boolean;
    friend: Friend | null;
    onClose: () => void;
    onNudge: (friend: Friend) => void;
}

const { width } = Dimensions.get('window');

export const FriendStatsModal: React.FC<FriendStatsModalProps> = ({
    visible,
    friend,
    onClose,
    onNudge,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    if (!friend) return null;

    const progressPercent = friend.todayCompletion || 0;
    const streak = friend.currentStreak || 0;

    // Circle progress calculations
    const size = 120;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark">
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={onClose}
                >
                    <Animated.View
                        entering={SlideInDown.springify().damping(20)}
                        style={styles.modalContainer}
                    >
                        <TouchableOpacity activeOpacity={1}>
                            <LinearGradient
                                colors={['rgba(30, 41, 59, 0.95)', 'rgba(15, 23, 42, 0.98)']}
                                style={styles.modalContent}
                            >
                                {/* Header */}
                                <View style={styles.header}>
                                    <View style={[styles.avatarLarge, { backgroundColor: colors.surfaceTertiary }]}>
                                        <Text style={styles.avatarText}>
                                            {friend.username[0]?.toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={[styles.username, { color: colors.textPrimary }]}>
                                        {friend.username}
                                    </Text>
                                    <Text style={[styles.email, { color: colors.textTertiary }]}>
                                        {friend.email}
                                    </Text>
                                </View>

                                {/* Stats Grid */}
                                <View style={styles.statsGrid}>
                                    {/* Today's Progress */}
                                    <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                        <Svg width={size} height={size}>
                                            {/* Background Circle */}
                                            <Circle
                                                stroke="rgba(255,255,255,0.1)"
                                                fill="none"
                                                cx={size / 2}
                                                cy={size / 2}
                                                r={radius}
                                                strokeWidth={strokeWidth}
                                            />
                                            {/* Progress Circle */}
                                            <Circle
                                                stroke={progressPercent >= 100 ? colors.success : colors.primary}
                                                fill="none"
                                                cx={size / 2}
                                                cy={size / 2}
                                                r={radius}
                                                strokeWidth={strokeWidth}
                                                strokeDasharray={circumference}
                                                strokeDashoffset={strokeDashoffset}
                                                strokeLinecap="round"
                                                rotation="-90"
                                                origin={`${size / 2}, ${size / 2}`}
                                            />
                                        </Svg>
                                        <View style={styles.progressCenter}>
                                            <Text style={[styles.progressValue, { color: colors.textPrimary }]}>
                                                {progressPercent}%
                                            </Text>
                                            <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>
                                                TODAY
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Streak & Stats */}
                                    <View style={styles.statsColumn}>
                                        <View style={[styles.miniCard, { backgroundColor: 'rgba(255,215,61,0.1)' }]}>
                                            <Ionicons name="flame" size={24} color="#FFD93D" />
                                            <Text style={styles.miniValue}>{streak}</Text>
                                            <Text style={[styles.miniLabel, { color: colors.textTertiary }]}>DAY STREAK</Text>
                                        </View>
                                        <View style={[styles.miniCard, { backgroundColor: 'rgba(0,255,148,0.1)' }]}>
                                            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                                            <Text style={styles.miniValue}>{Math.floor(progressPercent / 20)}/5</Text>
                                            <Text style={[styles.miniLabel, { color: colors.textTertiary }]}>HABITS TODAY</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Weekly Activity */}
                                <View style={styles.weeklySection}>
                                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                                        THIS WEEK
                                    </Text>
                                    <View style={styles.weekDays}>
                                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                                            const isActive = Math.random() > 0.3; // Mock data
                                            return (
                                                <View key={i} style={styles.dayColumn}>
                                                    <View
                                                        style={[
                                                            styles.dayDot,
                                                            {
                                                                backgroundColor: isActive
                                                                    ? colors.success
                                                                    : 'rgba(255,255,255,0.1)',
                                                            },
                                                        ]}
                                                    />
                                                    <Text style={[styles.dayLabel, { color: colors.textTertiary }]}>
                                                        {day}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Actions */}
                                <View style={styles.actions}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, { backgroundColor: colors.primary }]}
                                        onPress={() => {
                                            onNudge(friend);
                                            onClose();
                                        }}
                                    >
                                        <Text style={styles.actionText}>👋 Nudge</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.closeButton, { borderColor: colors.border }]}
                                        onPress={onClose}
                                    >
                                        <Text style={[styles.closeText, { color: colors.textSecondary }]}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </TouchableOpacity>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContainer: {
        width: width - 48,
        maxWidth: 400,
    },
    modalContent: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.5)',
    },
    username: {
        fontSize: 24,
        fontWeight: '700',
        fontFamily: 'SpaceGrotesk-Bold',
    },
    email: {
        fontSize: 14,
        marginTop: 4,
        fontFamily: 'SpaceMono-Regular',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        position: 'relative',
    },
    progressCenter: {
        position: 'absolute',
        alignItems: 'center',
    },
    progressValue: {
        fontSize: 28,
        fontWeight: '800',
        fontFamily: 'SpaceGrotesk-Bold',
    },
    progressLabel: {
        fontSize: 10,
        fontFamily: 'SpaceMono-Regular',
        letterSpacing: 1,
    },
    statsColumn: {
        flex: 1,
        gap: 12,
    },
    miniCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
    },
    miniValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginTop: 4,
    },
    miniLabel: {
        fontSize: 9,
        fontFamily: 'SpaceMono-Regular',
        letterSpacing: 0.5,
        marginTop: 2,
    },
    weeklySection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 11,
        fontFamily: 'SpaceMono-Regular',
        letterSpacing: 1,
        marginBottom: 12,
    },
    weekDays: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayColumn: {
        alignItems: 'center',
        gap: 8,
    },
    dayDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    dayLabel: {
        fontSize: 10,
        fontFamily: 'SpaceMono-Regular',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    actionText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    closeButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
    },
    closeText: {
        fontWeight: '600',
        fontSize: 16,
    },
});
