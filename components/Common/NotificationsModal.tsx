import { FontFamily, UIStyles } from '@/theme/designSystem';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated as RNAnimated } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { IconButton } from '@/components/ui/IconButton';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import Animated, { FadeInDown, FadeInUp, SlideOutRight } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { NotificationService, InAppNotification } from '@/lib/notificationService';
import { VoidCard } from '@/components/ui/VoidCard';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { useAccentGradient } from '@/context/AccentContext';
import { FriendsService } from '@/lib/friendsService';

interface NotificationsModalProps {
    visible: boolean;
    onClose: () => void;
}

// Group notifications by date bucket
function groupByDate(notifications: InAppNotification[]): { label: string; items: InAppNotification[] }[] {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    const groups: Record<string, InAppNotification[]> = { today: [], yesterday: [], earlier: [] };

    notifications.forEach(n => {
        if (n.timestamp >= todayStart) groups.today.push(n);
        else if (n.timestamp >= yesterdayStart) groups.yesterday.push(n);
        else groups.earlier.push(n);
    });

    const result: { label: string; items: InAppNotification[] }[] = [];
    if (groups.today.length > 0) result.push({ label: 'Today', items: groups.today });
    if (groups.yesterday.length > 0) result.push({ label: 'Yesterday', items: groups.yesterday });
    if (groups.earlier.length > 0) result.push({ label: 'Earlier', items: groups.earlier });
    return result;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ visible, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();
    const { primary: accentColor } = useAccentGradient();

    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible) {
            loadNotifications();
        }
    }, [visible]);

    const loadNotifications = async () => {
        setLoading(true);
        const data = await NotificationService.getInboxNotifications();
        setNotifications(data);
        setLoading(false);
    };

    const unreadCount = notifications.filter(n => !n.read).length;
    const grouped = useMemo(() => groupByDate(notifications), [notifications]);

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'success': return '#A3E635';
            case 'warning': return '#F59E0B';
            case 'habit': return '#2DD4BF';
            case 'streak': return '#F97316';
            case 'achievement': return '#A855F7';
            case 'nudge': return '#3B82F6';
            case 'friend_request': return '#EC4899';
            case 'shared_habit': return '#34D399'; // More vibrant emerald
            case 'shared_goal': return '#8B5CF6';
            default: return accentColor;
        }
    };

    const formatTimeAgo = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    };

    const handleMarkAllRead = async () => {
        lightFeedback();
        await NotificationService.markAllNotificationsRead();
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleDismiss = async (id: string) => {
        selectionFeedback();
        setNotifications(prev => prev.filter(n => n.id !== id));
        // Mark as read when dismissed
        await NotificationService.markNotificationRead(id);
    };

    const handleClearAll = () => {
        mediumFeedback();
        Alert.alert('Clear All', 'Remove all notifications?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear All',
                style: 'destructive',
                onPress: async () => {
                    const success = await NotificationService.clearAllNotifications();
                    if (success) {
                        setNotifications([]);
                        onClose();
                    } else {
                        Alert.alert('Error', 'Failed to clear notifications.');
                    }
                }
            }
        ]);
    };

    const handleNotificationPress = async (id: string) => {
        selectionFeedback();
        await NotificationService.markNotificationRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const handleAcceptShare = async (notification: InAppNotification) => {
        mediumFeedback();
        const type = notification.type === 'shared_habit' ? 'habit' : 'goal';
        const itemId = notification.data?.habitId || notification.data?.goalId;
        const ownerId = notification.fromUserId || notification.data?.fromUserId;
        if (!itemId || !ownerId) return;

        const success = await FriendsService.acceptShareRequest(type, itemId, ownerId);
        if (success) {
            await NotificationService.markNotificationRead(notification.id);
            setNotifications(prev => prev.map(n =>
                n.id === notification.id
                    ? { ...n, read: true, message: '✅ Accepted! You can now view this together.', data: { ...n.data, responded: true } }
                    : n
            ));
        } else {
            Alert.alert('Error', 'Failed to accept. Please try again.');
        }
    };

    const handleDeclineShare = async (notification: InAppNotification) => {
        selectionFeedback();
        const type = notification.type === 'shared_habit' ? 'habit' : 'goal';
        const itemId = notification.data?.habitId || notification.data?.goalId;
        const ownerId = notification.fromUserId || notification.data?.fromUserId;
        if (!itemId || !ownerId) return;

        const success = await FriendsService.declineShareRequest(type, itemId, ownerId);
        if (success) {
            await NotificationService.markNotificationRead(notification.id);
            setNotifications(prev => prev.map(n =>
                n.id === notification.id
                    ? { ...n, read: true, message: 'Declined.', data: { ...n.data, responded: true } }
                    : n
            ));
        }
    };

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <View style={styles.content}>
                <ModalHeader
                    title="Notifications"
                    subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                    onBack={onClose}
                    rightSlot={
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {unreadCount > 0 && (
                                <IconButton icon="checkmark-done" label="Mark all read" onPress={handleMarkAllRead} diameter={40} color={accentColor} />
                            )}
                            {notifications.length > 0 && (
                                <IconButton icon="trash-outline" label="Clear all" onPress={handleClearAll} diameter={40} size={18} color={colors.error} />
                            )}
                        </View>
                    }
                />

                {/* List */}
                <ScrollView style={styles.listContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {notifications.length === 0 ? (
                        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
                            <VoidCard glass style={styles.emptyCard}>
                                <IconTile icon="notifications-off" color={colors.textTertiary} size={64} style={{ marginBottom: 16 }} />
                                <Text style={[styles.emptyText, { color: colors.textPrimary }]}>All Clear!</Text>
                                <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                                    No notifications yet.{'\n'}New updates will appear here.
                                </Text>
                            </VoidCard>
                        </Animated.View>
                    ) : (
                        grouped.map((group, groupIndex) => (
                            <View key={group.label} style={{ marginBottom: 16 }}>
                                {/* Section Header */}
                                <View style={styles.sectionHeader}>
                                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: accentColor, marginRight: 8 }} />
                                    <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
                                        {group.label}
                                    </Text>
                                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border, marginLeft: 12 }} />
                                </View>

                                {/* Notifications in this group */}
                                {group.items.map((notification, index) => (
                                    <Animated.View
                                        key={notification.id}
                                        entering={FadeInDown.delay((groupIndex * 50) + (index * 30)).duration(300)}
                                        exiting={SlideOutRight.duration(200)}
                                    >
                                        <Swipeable
                                            renderRightActions={(progress, dragX) => {
                                                const trans = dragX.interpolate({
                                                    inputRange: [-100, 0],
                                                    outputRange: [0, 100],
                                                    extrapolate: 'clamp',
                                                });
                                                return (
                                                    <View style={{ width: 80, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                                        <RNAnimated.View style={{ transform: [{ translateX: trans }], width: '100%', height: '100%' }}>
                                                            <TouchableOpacity
                                                                onPress={() => handleDismiss(notification.id)}
                                                                style={{
                                                                    backgroundColor: '#EF4444',
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    borderTopRightRadius: 16,
                                                                    borderBottomRightRadius: 16,
                                                                    marginBottom: 6,
                                                                    marginTop: 0,
                                                                }}>
                                                                <Ionicons name="trash" size={24} color="white" />
                                                            </TouchableOpacity>
                                                        </RNAnimated.View>
                                                    </View>
                                                );
                                            }}
                                            rightThreshold={40}
                                            friction={2}
                                            overshootRight={false}
                                            overshootFriction={4}
                                            useNativeAnimations
                                            containerStyle={{ overflow: 'visible' }}
                                        >
                                            <TouchableOpacity
                                                onPress={() => handleNotificationPress(notification.id)}
                                                onLongPress={() => handleDismiss(notification.id)}
                                                delayLongPress={400}
                                                activeOpacity={0.9}
                                            >
                                                <VoidCard glass style={{ ...styles.notificationItem, ...(!notification.read ? styles.unreadItem : {}) }}>
                                                    <View style={[styles.notifIconContainer, { backgroundColor: getTypeColor(notification.type) + '15' }]}>
                                                        <Ionicons name={notification.icon as any} size={18} color={getTypeColor(notification.type)} />
                                                    </View>
                                                    <View style={styles.notifContent}>
                                                        <View style={styles.titleRow}>
                                                            <Text style={[styles.notificationTitle, { color: colors.text, fontFamily: notification.read ? FontFamily.medium : FontFamily.bold }]} numberOfLines={1}>
                                                                {notification.title}
                                                            </Text>
                                                            <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
                                                                {formatTimeAgo(notification.timestamp)}
                                                            </Text>
                                                        </View>
                                                        <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                                                            {notification.message}
                                                        </Text>

                                                        {/* Accept/Refuse buttons for share requests */}
                                                        {(notification.type === 'shared_habit' || notification.type === 'shared_goal') && !notification.data?.responded && (
                                                            <View style={styles.shareActions}>
                                                                <TouchableOpacity
                                                                    onPress={() => handleAcceptShare(notification)}
                                                                    style={[styles.shareBtn, { backgroundColor: colors.success + '20' }]}
                                                                >
                                                                    <Ionicons name="checkmark" size={14} color={colors.success} />
                                                                    <Text style={[styles.shareBtnText, { color: colors.success }]}>Accept</Text>
                                                                </TouchableOpacity>
                                                                <TouchableOpacity
                                                                    onPress={() => handleDeclineShare(notification)}
                                                                    style={[styles.shareBtn, { backgroundColor: colors.error + '15' }]}
                                                                >
                                                                    <Ionicons name="close" size={14} color={colors.error} />
                                                                    <Text style={[styles.shareBtnText, { color: colors.error }]}>Decline</Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                        )}
                                                    </View>
                                                    {!notification.read && <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />}
                                                </VoidCard>
                                            </TouchableOpacity>
                                        </Swipeable>
                                    </Animated.View>
                                ))}
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontFamily: FontFamily.bold,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 4,
    },
    sectionLabel: { ...UIStyles.sectionTitle, marginBottom: 0 },
    listContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    emptyCard: {
        alignItems: 'center',
        padding: 48,
        marginTop: 40,
    },
    emptyText: {
        fontSize: 18,
        fontFamily: FontFamily.bold,
    },
    emptySubtext: {
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 18,
        fontFamily: FontFamily.regular,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        marginBottom: 6,
    },
    unreadItem: {
        borderLeftWidth: 3,
        borderLeftColor: '#2DD4BF',
    },
    notifIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    notifContent: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    notificationTitle: {
        fontSize: 13,
        flex: 1,
        fontFamily: FontFamily.regular,
    },
    unreadDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginLeft: 8,
    },
    notificationMessage: {
        fontSize: 11,
        fontFamily: FontFamily.regular,
        lineHeight: 16,
    },
    notificationTime: {
        fontSize: 9,
        fontFamily: FontFamily.regular,
        marginLeft: 8,
    },
    shareActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 10,
    },
    shareBtnText: {
        fontSize: 12,
        fontFamily: FontFamily.semibold,
    },
});
