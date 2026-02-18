import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

// ============================================
// Session Rating Card (per HabyssTimer.md §5.2)
// Post-session quality feedback — 5 emoji scale
// ============================================

interface SessionRatingCardProps {
    habitName: string;
    duration: number; // seconds
    onRate: (rating: number) => void;
    onSkip: () => void;
    visible: boolean;
}

const RATINGS = [
    { emoji: '😩', label: 'Brutal', value: 1 },
    { emoji: '😐', label: 'Meh', value: 2 },
    { emoji: '😊', label: 'Good', value: 3 },
    { emoji: '🔥', label: 'Fire', value: 4 },
    { emoji: '⚡', label: 'Zone', value: 5 },
];

export const SessionRatingCard: React.FC<SessionRatingCardProps> = ({
    habitName,
    duration,
    onRate,
    onSkip,
    visible,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [selected, setSelected] = useState<number | null>(null);

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        return `${m} min`;
    };

    const handleSelect = (value: number) => {
        setSelected(value);
        // Brief delay for the tap animation then submit
        setTimeout(() => onRate(value), 300);
    };

    if (!visible) return null;

    return (
        <Animated.View
            entering={FadeInUp.duration(400).springify()}
            exiting={FadeOutDown.duration(300)}
            style={[styles.container, {
                backgroundColor: 'rgba(20, 20, 30, 0.95)',
                borderColor: 'rgba(255,255,255,0.08)',
            }]}
        >
            {/* Header */}
            <Text style={[styles.title, { color: colors.textPrimary }]}>
                Session complete! 🎯
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {formatDuration(duration)} · {habitName}
            </Text>

            {/* Question */}
            <Text style={[styles.question, { color: colors.textSecondary }]}>
                How was that session?
            </Text>

            {/* Emoji Ratings */}
            <View style={styles.ratingsRow}>
                {RATINGS.map((r) => (
                    <TouchableOpacity
                        key={r.value}
                        onPress={() => handleSelect(r.value)}
                        style={[
                            styles.ratingButton,
                            selected === r.value && {
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                borderColor: colors.primary,
                            },
                        ]}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.ratingEmoji}>{r.emoji}</Text>
                        <Text style={[styles.ratingLabel, { color: colors.textTertiary }]}>
                            {r.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Skip */}
            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                <Text style={[styles.skipText, { color: colors.textTertiary }]}>Skip</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 24,
        marginHorizontal: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontFamily: 'Lexend',
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
        marginBottom: 20,
    },
    question: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
        marginBottom: 16,
    },
    ratingsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
    },
    ratingButton: {
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
        minWidth: 54,
    },
    ratingEmoji: {
        fontSize: 24,
        marginBottom: 4,
    },
    ratingLabel: {
        fontSize: 9,
        fontFamily: 'Lexend_400Regular',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    skipButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    skipText: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
});
