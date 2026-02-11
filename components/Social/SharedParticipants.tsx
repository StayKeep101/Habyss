import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { FriendsService } from '@/lib/friendsService';

interface Participant {
    userId: string;
    username: string;
    avatarUrl?: string;
    completedToday: boolean;
    isOwner: boolean;
}

interface SharedParticipantsProps {
    itemId: string;
    itemType: 'habit' | 'goal';
}

export const SharedParticipants: React.FC<SharedParticipantsProps> = ({ itemId, itemType }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const data = await FriendsService.getSharedItemParticipants(itemId, itemType);
                if (mounted) setParticipants(data);
            } catch (e) {
                console.error('Error loading participants:', e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [itemId, itemType]);

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" color={accentColor} />
            </View>
        );
    }

    if (participants.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="people" size={14} color={colors.textSecondary} />
                <Text style={[styles.headerText, { color: colors.textSecondary }]}>
                    Shared with {participants.length - 1} {participants.length - 1 === 1 ? 'person' : 'people'}
                </Text>
            </View>
            <View style={styles.participantsList}>
                {participants.map(p => (
                    <View key={p.userId} style={styles.participantRow}>
                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                            {p.avatarUrl ? (
                                <Image source={{ uri: p.avatarUrl }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: accentColor + '30' }]}>
                                    <Text style={[styles.avatarInitial, { color: accentColor }]}>
                                        {p.username.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            {/* Completion indicator */}
                            <View style={[
                                styles.statusDot,
                                { backgroundColor: p.completedToday ? colors.success : colors.textTertiary + '50' },
                            ]}>
                                {p.completedToday && (
                                    <Ionicons name="checkmark" size={8} color="#fff" />
                                )}
                            </View>
                        </View>

                        {/* Name */}
                        <Text
                            style={[styles.participantName, { color: colors.textPrimary }]}
                            numberOfLines={1}
                        >
                            {p.username}
                        </Text>

                        {/* Badges */}
                        {p.isOwner && (
                            <View style={[styles.badge, { backgroundColor: accentColor + '20' }]}>
                                <Text style={[styles.badgeText, { color: accentColor }]}>Owner</Text>
                            </View>
                        )}

                        {/* Today status */}
                        <Text style={[styles.statusText, { color: p.completedToday ? colors.success : colors.textTertiary }]}>
                            {p.completedToday ? 'Done' : 'Pending'}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        paddingTop: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    headerText: {
        fontSize: 12,
        fontFamily: 'Lexend_500Medium',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    participantsList: {
        gap: 8,
    },
    participantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 14,
        fontFamily: 'Lexend_600SemiBold',
    },
    statusDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#050505',
    },
    participantName: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Lexend_500Medium',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: 'Lexend_600SemiBold',
        textTransform: 'uppercase',
    },
    statusText: {
        fontSize: 12,
        fontFamily: 'Lexend_500Medium',
    },
});
