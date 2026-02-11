import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    runOnJS,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { FriendsService, Friend } from '@/lib/friendsService';
import { subscribeToHabits, Habit } from '@/lib/habitsSQLite';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.50;
const DRAG_THRESHOLD = 60;

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

    const [friends, setFriends] = useState<Friend[]>([]);
    const [sharedWith, setSharedWith] = useState<string[]>([]);
    const [initialSharedWith, setInitialSharedWith] = useState<string[]>([]);
    const [linkedHabits, setLinkedHabits] = useState<Habit[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 250 });
        contentOpacity.value = withDelay(150, withTiming(1, { duration: 300 }));
    }, []);

    const closeModal = useCallback(() => {
        contentOpacity.value = withTiming(0, { duration: 100 });
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 250, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        setTimeout(() => { setIsOpen(false); onClose(); }, 250);
    }, [onClose]);

    useEffect(() => {
        if (visible && !isOpen) {
            openModal();
            loadData();
        } else if (!visible && isOpen) {
            closeModal();
        }
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

        // Fetch linked habits for auto-sharing
        const unsubPromise = subscribeToHabits((allHabits) => {
            setLinkedHabits(allHabits.filter(h => h.goalId === goalId && !h.isGoal));
        });
        unsubPromise.then(unsub => unsub()); // One-shot read

        setLoading(false);
    };

    const toggleShare = (friendId: string) => {
        lightFeedback();
        setSharedWith(prev => prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]);
    };

    const handleSave = async () => {
        setSaving(true);
        successFeedback();

        // Compute diffs from the initial state (no re-fetch needed)
        const toShare = sharedWith.filter(id => !initialSharedWith.includes(id));
        const toUnshare = initialSharedWith.filter(id => !sharedWith.includes(id));

        // Close immediately (optimistic) — operations fire in background
        closeModal();

        // Batch operations in parallel: share/unshare goal AND all linked habits
        const habitOps: Promise<boolean>[] = [];

        // Auto-share all linked habits with newly shared friends
        for (const friendId of toShare) {
            for (const habit of linkedHabits) {
                habitOps.push(FriendsService.shareHabitWithFriend(habit.id, friendId));
            }
        }

        // Auto-unshare all linked habits from unshared friends
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

    const panGesture = Gesture.Pan()
        .onUpdate((event) => { if (event.translationY > 0) translateY.value = event.translationY; })
        .onEnd((event) => {
            if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) runOnJS(closeModal)();
            else translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        });

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP) }));
    const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

    if (!isOpen && !visible) return null;

    return (
        <Modal visible={isOpen || visible} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
            <View style={styles.container}>
                <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
                    <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} activeOpacity={1} onPress={closeModal} />
                </Animated.View>

                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetStyle]}>
                        <LinearGradient colors={['#0f1218', '#080a0e']} style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder]} />

                        <Animated.View style={[styles.content, contentStyle]}>
                            <View style={styles.dragIndicator} />
                            <Text style={styles.title}>SHARE GOAL</Text>
                            <Text style={[styles.subtitle, { color: '#10B981' }]} numberOfLines={1}>{goalName.toUpperCase()}</Text>
                            <Text style={styles.description}>Collaborate or compete with friends to achieve this goal together</Text>

                            {loading ? (
                                <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
                            ) : friends.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.2)" />
                                    <Text style={styles.emptyText}>No friends yet</Text>
                                    <Text style={styles.emptySubtext}>Add friends to share goals with them</Text>
                                </View>
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsRow}>
                                    {friends.map(friend => {
                                        const isShared = sharedWith.includes(friend.id);
                                        return (
                                            <TouchableOpacity key={friend.id} onPress={() => toggleShare(friend.id)} style={[styles.friendChip, isShared && styles.friendChipActive]}>
                                                <View style={[styles.avatar, isShared && { backgroundColor: '#10B981' }]}>
                                                    <Text style={{ fontSize: 12, color: isShared ? '#fff' : colors.textSecondary, fontFamily: 'Lexend' }}>{friend.username[0]?.toUpperCase()}</Text>
                                                </View>
                                                <Text style={[styles.friendName, { color: isShared ? '#10B981' : colors.textSecondary }]} numberOfLines={1}>{friend.username}</Text>
                                                {isShared && <Ionicons name="checkmark" size={14} color="#10B981" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}

                            <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveButton, { opacity: saving ? 0.6 : 1 }]}>
                                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save Changes</Text>}
                            </TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(16, 185, 129, 0.15)', pointerEvents: 'none' },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, alignItems: 'center' },
    dragIndicator: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 16 },
    title: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: 'Lexend' },
    subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1, fontFamily: 'Lexend_400Regular', marginTop: 2, marginBottom: 8 },
    description: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontFamily: 'Lexend_400Regular', marginBottom: 16, paddingHorizontal: 20 },
    emptyState: { alignItems: 'center', paddingVertical: 30 },
    emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8, fontFamily: 'Lexend_400Regular' },
    emptySubtext: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4, fontFamily: 'Lexend_400Regular' },
    friendsRow: { paddingVertical: 8, gap: 10 },
    friendChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    friendChipActive: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    friendName: { fontSize: 13, fontWeight: '600', maxWidth: 80, fontFamily: 'Lexend' },
    saveButton: { marginTop: 20, backgroundColor: '#10B981', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
    saveText: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'Lexend' },
});
