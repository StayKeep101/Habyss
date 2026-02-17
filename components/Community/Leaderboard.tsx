import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { useAccentGradient } from '@/constants/AccentContext';
import { Friend } from '@/lib/friendsService';
import { VoidCard } from '@/components/Layout/VoidCard';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withRepeat, Easing, withSpring, withDelay } from 'react-native-reanimated';

interface LeaderboardProps {
    leaderboard: { rank: number; friend: Friend }[];
    period: 'week' | 'month' | 'year' | 'all';
    onPeriodChange: (period: 'week' | 'month' | 'year' | 'all') => void;
    onFriendPress: (friend: Friend) => void;
    isLoading?: boolean;
}

export function Leaderboard({ leaderboard, period, onPeriodChange, onFriendPress, isLoading }: LeaderboardProps) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary: accentColor } = useAccentGradient();

    const topThree = leaderboard.slice(0, 3);
    const rest = leaderboard.slice(3);

    const firstPlace = topThree.find(item => item.rank === 1);
    const secondPlace = topThree.find(item => item.rank === 2);
    const thirdPlace = topThree.find(item => item.rank === 3);

    // Animation for crown
    const crownScale = useSharedValue(1);
    const podiumTranslateY = useSharedValue(50);
    const podiumOpacity = useSharedValue(0);

    useEffect(() => {
        crownScale.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        podiumTranslateY.value = withSpring(0, { damping: 12 });
        podiumOpacity.value = withTiming(1, { duration: 800 });
    }, []);

    const animatedCrownStyle = useAnimatedStyle(() => ({
        transform: [{ scale: crownScale.value }]
    }));

    const animatedPodiumStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: podiumTranslateY.value }],
        opacity: podiumOpacity.value
    }));

    const renderPodiumItem = (item: { rank: number; friend: Friend } | undefined, position: 'first' | 'second' | 'third') => {
        if (!item) return <View style={{ flex: 1 }} />;

        const isFirst = position === 'first';
        const isSecond = position === 'second';

        // Config based on position
        const height = isFirst ? 160 : isSecond ? 130 : 110;
        const avatarSize = isFirst ? 64 : isSecond ? 48 : 42;
        const placeColor = isFirst ? '#FFD700' : isSecond ? '#C0C0C0' : '#CD7F32';
        const glowColor = isFirst ? 'rgba(255, 215, 0, 0.4)' : isSecond ? 'rgba(192, 192, 192, 0.3)' : 'rgba(205, 127, 50, 0.3)';
        const translateY = isFirst ? -20 : 0;
        const zIndex = isFirst ? 10 : 1;

        return (
            <TouchableOpacity
                style={{ flex: 1, alignItems: 'center', zIndex, transform: [{ translateY }] }}
                onPress={() => onFriendPress(item.friend)}
                activeOpacity={0.8}
            >
                {/* Avatar with Glow */}
                <View style={{
                    shadowColor: placeColor,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: isFirst ? 0.8 : 0.5,
                    shadowRadius: isFirst ? 15 : 10,
                    marginBottom: 8,
                    alignItems: 'center'
                }}>
                    {isFirst && (
                        <Animated.Text style={[{ fontSize: 24, marginBottom: -8, zIndex: 20 }, animatedCrownStyle]}>
                            👑
                        </Animated.Text>
                    )}

                    <View style={{
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                        borderWidth: isFirst ? 3 : 2,
                        borderColor: placeColor,
                        backgroundColor: colors.surfaceTertiary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        <Text style={{ fontSize: avatarSize / 2.5, color: colors.textSecondary }}>
                            {item.friend.username[0]?.toUpperCase()}
                        </Text>
                    </View>

                    {/* Rank Badge */}
                    <View style={{
                        position: 'absolute',
                        bottom: -6,
                        backgroundColor: placeColor,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: colors.background
                    }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#FFF' }}>{item.rank}</Text>
                    </View>
                </View>

                {/* Name & Streak */}
                <Text style={{
                    color: item.friend.isCurrentUser ? accentColor : colors.textPrimary,
                    fontSize: isFirst ? 14 : 12,
                    fontWeight: '700',
                    textAlign: 'center',
                    fontFamily: 'Lexend',
                    marginBottom: 2
                }} numberOfLines={1}>
                    {item.friend.isCurrentUser ? 'You' : item.friend.username}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="flame" size={12} color={placeColor} />
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginLeft: 2, fontFamily: 'Lexend' }}>
                        {item.friend.currentStreak}
                    </Text>
                </View>

                {/* Podium Base */}
                <View style={{
                    marginTop: 12,
                    width: '100%',
                    height: height - 60, // approximate visual height
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    overflow: 'hidden',
                }}>
                    <LinearGradient
                        colors={[
                            placeColor,
                            isLight ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0)'
                        ]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={{ flex: 1, opacity: 0.15 }}
                    />
                    {/* Glass effect helper */}
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: isLight ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)' }]} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 2 }]}>LEADERBOARD</Text>
                    <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: 'Lexend_400Regular' }}>
                        Based on streak consistency
                    </Text>
                </View>
            </View>

            {/* Time Period Selector */}
            <View style={{
                flexDirection: 'row',
                backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                borderRadius: 12,
                padding: 4,
                marginBottom: 24,
            }}>
                {[
                    { id: 'week', label: 'Week' },
                    { id: 'month', label: 'Month' },
                    { id: 'year', label: 'Year' },
                    { id: 'all', label: 'All Time' },
                ].map(p => (
                    <TouchableOpacity
                        key={p.id}
                        onPress={() => onPeriodChange(p.id as any)}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 10,
                            backgroundColor: period === p.id ? accentColor : 'transparent',
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: period === p.id ? '#fff' : colors.textSecondary,
                            fontSize: 12,
                            fontWeight: period === p.id ? '700' : '500',
                            fontFamily: 'Lexend',
                        }}>
                            {p.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {leaderboard.length === 0 ? (
                <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 32, alignItems: 'center' }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name="trophy-outline" size={40} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 12 }]}>No rankings yet</Text>
                    <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>Add friends to compete!</Text>
                </VoidCard>
            ) : (
                <>
                    {/* Podium Layout */}
                    {leaderboard.length >= 1 && (
                        <Animated.View style={[{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 24, paddingHorizontal: 12 }, animatedPodiumStyle]}>
                            {renderPodiumItem(secondPlace, 'second')}
                            {renderPodiumItem(firstPlace, 'first')}
                            {renderPodiumItem(thirdPlace, 'third')}
                        </Animated.View>
                    )}

                    {/* List View for Rest */}
                    {rest.length > 0 && (
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 4 }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            {rest.map((item, index) => (
                                <TouchableOpacity
                                    key={`rank_${item.friend.id}`}
                                    onPress={() => onFriendPress(item.friend)}
                                    activeOpacity={0.7}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 12,
                                        paddingHorizontal: 12,
                                        borderBottomWidth: index === rest.length - 1 ? 0 : 1,
                                        borderBottomColor: 'rgba(255,255,255,0.05)',
                                        backgroundColor: item.friend.isCurrentUser ? (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)') : 'transparent'
                                    }}
                                >
                                    <View style={{ width: 24, alignItems: 'center', marginRight: 12 }}>
                                        <Text style={{ color: colors.textTertiary, fontWeight: '700', fontFamily: 'Lexend' }}>{item.rank}</Text>
                                    </View>

                                    <View style={{
                                        width: 32, height: 32, borderRadius: 16,
                                        backgroundColor: colors.surfaceTertiary,
                                        alignItems: 'center', justifyContent: 'center',
                                        marginRight: 12,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.1)'
                                    }}>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                            {item.friend.username[0]?.toUpperCase()}
                                        </Text>
                                    </View>

                                    <Text style={{
                                        flex: 1,
                                        color: item.friend.isCurrentUser ? accentColor : colors.textPrimary,
                                        fontWeight: item.friend.isCurrentUser ? '700' : '400',
                                        fontFamily: 'Lexend'
                                    }}>
                                        {item.friend.isCurrentUser ? 'You' : item.friend.username}
                                    </Text>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', opacity: 0.8 }}>
                                        <Ionicons name="flame" size={14} color={colors.textTertiary} />
                                        <Text style={{ color: colors.textSecondary, marginLeft: 4, fontWeight: '600', fontFamily: 'Lexend' }}>
                                            {item.friend.currentStreak}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </VoidCard>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    sectionLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        fontFamily: 'Lexend_400Regular',
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 12,
        fontFamily: 'Lexend',
    },
    emptySubtext: {
        fontSize: 11,
        marginTop: 4,
        fontFamily: 'Lexend_400Regular',
    },
});
