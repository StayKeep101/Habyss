import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';
import { FriendsService, Friend } from '@/lib/friendsService';
import { subscribeToHabits, Habit } from '@/lib/habitsSQLite';
import { AppButton } from '@/components/Common/AppButton';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';

interface ShareGoalModalProps {
    visible: boolean;
    goalId: string;
    goalName: string;
    onClose: () => void;
}

export const ShareGoalModal: React.FC<ShareGoalModalProps> = ({ visible, goalId, goalName, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, successFeedback } = useHaptics();
    const { primary: accentColor } = useAccentGradient();
    const isLight = theme === 'light';

    const [friends, setFriends] = useState<Friend[]>([]);
    const [sharedWith, setSharedWith] = useState<string[]>([]);
    const [initialSharedWith, setInitialSharedWith] = useState<string[]>([]);
    const [linkedHabits, setLinkedHabits] = useState<Habit[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) loadData();
    }, [visible]);

    const loadData = async () => {
        setLoading(true);
        const [friendsList, alreadyShared] = await Promise.all([
            FriendsService.getFriends(),
            FriendsService.getGoalSharedWith(goalId),
        ]);
        setFriends(friendsList);
        const sharedIds = alreadyShared.map(f => f.id);
        setSharedWith(sharedIds);
        setInitialSharedWith(sharedIds);

        const unsubPromise = subscribeToHabits((allHabits) => {
            setLinkedHabits(allHabits.filter(h => h.goalId === goalId && !h.isGoal));
        });
        unsubPromise.then(unsub => unsub());

        setLoading(false);
    };

    const toggleShare = (friendId: string) => {
        lightFeedback();
        setSharedWith(prev => prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]);
    };

    const handleSave = async () => {
        setSaving(true);
        successFeedback();

        const toShare = sharedWith.filter(id => !initialSharedWith.includes(id));
        const toUnshare = initialSharedWith.filter(id => !sharedWith.includes(id));

        onClose();

        const habitOps: Promise<boolean>[] = [];
        for (const friendId of toShare) {
            for (const habit of linkedHabits) {
                habitOps.push(FriendsService.shareHabitWithFriend(habit.id, friendId));
            }
        }
        for (const friendId of toUnshare) {
            for (const habit of linkedHabits) {
                habitOps.push(FriendsService.unshareHabit(habit.id, friendId));
            }
        }

        await Promise.all([
            FriendsService.batchShareGoal(goalId, toShare),
            FriendsService.batchUnshareGoal(goalId, toUnshare),
            ...habitOps,
        ]);

        setSaving(false);
    };

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.55}>
            <View style={{ flex: 1 }}>
                <ModalHeader title="SHARE GOAL" subtitle={goalName.toUpperCase()} onBack={onClose} />

                <Text style={[styles.description, { color: colors.textSecondary }]}>
                    Collaborate or compete with friends to achieve this goal together
                </Text>

                {loading ? (
                    <ActivityIndicator color={accentColor} style={{ marginVertical: 30 }} />
                ) : friends.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={36} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No friends yet</Text>
                        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>Add friends to share goals with them</Text>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsRow}>
                        {friends.map(friend => {
                            const isShared = sharedWith.includes(friend.id);
                            return (
                                <TouchableOpacity
                                    key={friend.id}
                                    onPress={() => toggleShare(friend.id)}
                                    style={[
                                        styles.friendChip,
                                        { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.03)', borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)' },
                                        isShared && { backgroundColor: accentColor + '15', borderColor: accentColor },
                                    ]}
                                >
                                    <View style={[styles.avatar, { backgroundColor: isShared ? accentColor : (isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.1)') }]}>
                                        <Text style={{ fontSize: 12, color: isShared ? '#fff' : colors.textSecondary, fontFamily: 'Lexend' }}>{friend.username[0]?.toUpperCase()}</Text>
                                    </View>
                                    <Text style={[styles.friendName, { color: isShared ? accentColor : colors.textPrimary }]} numberOfLines={1}>{friend.username}</Text>
                                    {isShared && <Ionicons name="checkmark" size={14} color={accentColor} />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                <View style={styles.saveContainer}>
                    <AppButton label="Save Changes" onPress={handleSave} loading={saving} />
                </View>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    description: {
        fontSize: 13,
        textAlign: 'center',
        fontFamily: 'Lexend_400Regular',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    emptyState: { alignItems: 'center', paddingVertical: 30 },
    emptyText: { fontSize: 12, marginTop: 8, fontFamily: 'Lexend_400Regular' },
    emptySubtext: { fontSize: 11, marginTop: 4, fontFamily: 'Lexend_400Regular' },
    friendsRow: { paddingHorizontal: 20, paddingVertical: 8, gap: 10 },
    friendChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    friendName: { fontSize: 13, fontWeight: '600', maxWidth: 80, fontFamily: 'Lexend' },
    saveContainer: { paddingHorizontal: 24, marginTop: 'auto', paddingBottom: 20 },
});
