import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';
import { FriendsService, Friend } from '@/lib/friendsService';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';

interface ShareHabitModalProps {
    visible: boolean;
    habitId: string;
    habitName: string;
    onClose: () => void;
}

export const ShareHabitModal: React.FC<ShareHabitModalProps> = ({ visible, habitId, habitName, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, successFeedback } = useHaptics();
    const { primary: accentColor } = useAccentGradient();
    const isLight = theme === 'light';

    const [friends, setFriends] = useState<Friend[]>([]);
    const [sharedWith, setSharedWith] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) loadData();
    }, [visible]);

    const loadData = async () => {
        setLoading(true);
        const [friendsList, alreadyShared] = await Promise.all([
            FriendsService.getFriends(),
            FriendsService.getHabitSharedWith(habitId),
        ]);
        setFriends(friendsList);
        setSharedWith(alreadyShared.map(f => f.id));
        setLoading(false);
    };

    const toggleShare = (friendId: string) => {
        lightFeedback();
        setSharedWith(prev => prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]);
    };

    const handleSave = async () => {
        setSaving(true);
        const currentShared = await FriendsService.getHabitSharedWith(habitId);
        const currentIds = currentShared.map(f => f.id);
        for (const id of currentIds) { if (!sharedWith.includes(id)) await FriendsService.unshareHabit(habitId, id); }
        for (const id of sharedWith) { if (!currentIds.includes(id)) await FriendsService.shareHabitWithFriend(habitId, id); }
        successFeedback();
        setSaving(false);
        onClose();
    };

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.55}>
            <View style={{ flex: 1 }}>
                <ModalHeader title="SHARE" subtitle={habitName.toUpperCase()} onBack={onClose} />

                <Text style={[styles.description, { color: colors.textSecondary }]}>
                    Share this habit with friends to stay accountable together
                </Text>

                {loading ? (
                    <ActivityIndicator color={accentColor} style={{ marginVertical: 30 }} />
                ) : friends.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={36} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No friends yet</Text>
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
                    <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveButton, { backgroundColor: accentColor, opacity: saving ? 0.6 : 1 }]}>
                        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save Changes</Text>}
                    </TouchableOpacity>
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
    saveButton: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    saveText: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'Lexend' },
});
