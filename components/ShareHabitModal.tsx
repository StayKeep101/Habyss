import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { FriendsService, Friend } from '@/lib/friendsService';

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

    const [friends, setFriends] = useState<Friend[]>([]);
    const [sharedWith, setSharedWith] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) {
            loadData();
        }
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
        setSharedWith(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        );
    };

    const handleSave = async () => {
        setSaving(true);

        // Get current shared list
        const currentShared = await FriendsService.getHabitSharedWith(habitId);
        const currentIds = currentShared.map(f => f.id);

        // Unshare from removed friends
        for (const id of currentIds) {
            if (!sharedWith.includes(id)) {
                await FriendsService.unshareHabit(habitId, id);
            }
        }

        // Share with new friends
        for (const id of sharedWith) {
            if (!currentIds.includes(id)) {
                await FriendsService.shareHabitWithFriend(habitId, id);
            }
        }

        successFeedback();
        setSaving(false);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View
                    entering={SlideInDown.springify().damping(15)}
                    exiting={SlideOutDown}
                    style={styles.sheet}
                >
                    <LinearGradient colors={['#334155', '#0f172a']} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 32, pointerEvents: 'none' }]} />

                    <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
                        <View style={{ padding: 24 }}>
                            {/* Handle */}
                            <View style={{ alignItems: 'center', marginBottom: 16 }}>
                                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                            </View>

                            {/* Title */}
                            <Text style={[styles.title, { color: colors.textPrimary }]}>Share Habit</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 24, fontFamily: 'SpaceMono-Regular' }}>
                                "{habitName}"
                            </Text>

                            {loading ? (
                                <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
                            ) : friends.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                    <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                                    <Text style={{ color: colors.textSecondary, marginTop: 12 }}>No friends yet</Text>
                                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                                        Add friends to share habits with them
                                    </Text>
                                </View>
                            ) : (
                                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                                    {friends.map(friend => {
                                        const isShared = sharedWith.includes(friend.id);
                                        return (
                                            <TouchableOpacity
                                                key={friend.id}
                                                onPress={() => toggleShare(friend.id)}
                                                style={[styles.friendRow, isShared && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                                            >
                                                <View style={styles.avatar}>
                                                    <Text style={{ fontSize: 14 }}>{friend.username[0]?.toUpperCase()}</Text>
                                                </View>
                                                <Text style={[styles.friendName, { color: colors.textPrimary }]}>{friend.username}</Text>
                                                <Ionicons
                                                    name={isShared ? 'checkmark-circle' : 'ellipse-outline'}
                                                    size={24}
                                                    color={isShared ? colors.primary : colors.textTertiary}
                                                />
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}

                            {/* Actions */}
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={[styles.button, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                                >
                                    <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSave}
                                    disabled={saving}
                                    style={[styles.button, { backgroundColor: colors.primary, flex: 2, opacity: saving ? 0.6 : 1 }]}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={{ height: 20 }} />
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    friendName: {
        flex: 1,
        marginLeft: 12,
        fontSize: 14,
        fontWeight: '600',
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
