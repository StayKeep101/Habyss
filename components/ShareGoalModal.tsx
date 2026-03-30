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
import { useAccentGradient } from '@/constants/AccentContext';
import { FriendsService, Friend } from '@/lib/friendsService';
import { subscribeToHabits, Habit } from '@/lib/habitsSQLite';
import { AppButton } from '@/components/Common/AppButton';
import { ModalHeader } from '@/components/Layout/ModalHeader';

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
    const { primary: accentColor } = useAccentGradient();
    const isLight = theme === 'light';

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
                        <LinearGradient colors={isLight ? [colors.surface, colors.background] : ['#0f1218', '#080a0e']} style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder, { borderColor: accentColor + '15' }]} />

                        <Animated.View style={[styles.content, contentStyle]}>
                            <ModalHeader title="Share Goal" subtitle={goalName.toUpperCase()} onBack={closeModal} />
                            <Text style={[styles.description, { color: colors.textSecondary }]}>Collaborate or compete with friends to achieve this goal together</Text>

                            {loading ? (
                                <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
                            ) : friends.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="people-outline" size={36} color={colors.textTertiary} />
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No friends yet</Text>
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
                                                    {
                                                        backgroundColor: isShared ? accentColor + '14' : colors.surfaceSecondary,
                                                        borderColor: isShared ? accentColor : colors.border,
                                                    },
                                                ]}
                                            >
                                                <View style={[styles.avatar, { backgroundColor: isShared ? accentColor : colors.surface }]}>
                                                    <Text style={{ fontSize: 12, color: isShared ? '#fff' : colors.textSecondary, fontFamily: 'Lexend' }}>{friend.username[0]?.toUpperCase()}</Text>
                                                </View>
                                                <Text style={[styles.friendName, { color: isShared ? accentColor : colors.textSecondary }]} numberOfLines={1}>{friend.username}</Text>
                                                {isShared && <Ionicons name="checkmark" size={14} color={accentColor} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}

                            <AppButton label="Save Changes" onPress={handleSave} loading={saving} style={styles.saveButton} />
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
    content: { flex: 1, paddingBottom: 32 },
    dragIndicator: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 16 },
    description: { fontSize: 12, textAlign: 'center', fontFamily: 'Lexend_400Regular', marginTop: 14, marginBottom: 16, paddingHorizontal: 24 },
    emptyState: { alignItems: 'center', paddingVertical: 30 },
    emptyText: { fontSize: 12, marginTop: 8, fontFamily: 'Lexend_400Regular' },
    emptySubtext: { fontSize: 11, marginTop: 4, fontFamily: 'Lexend_400Regular' },
    friendsRow: { paddingHorizontal: 24, paddingVertical: 8, gap: 10 },
    friendChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1 },
    avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    friendName: { fontSize: 13, fontWeight: '600', maxWidth: 80, fontFamily: 'Lexend' },
    saveButton: { marginTop: 20, marginHorizontal: 24 },
});
