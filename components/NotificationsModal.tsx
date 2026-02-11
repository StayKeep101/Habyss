import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, SlideOutRight } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { NotificationService, InAppNotification } from '@/lib/notificationService';
import { VoidCard } from '@/components/Layout/VoidCard';
import { VoidModal } from '@/components/Layout/VoidModal';
import { useAccentGradient } from '@/constants/AccentContext';
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
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.75}>
            <View style={styles.content}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.title, { color: colors.text }]}>NOTIFICATIONS</Text>
                        <Text style={[styles.subtitle, { color: accentColor }]}>
                            {unreadCount > 0 ? `${unreadCount} UNREAD` : 'ALL CAUGHT UP'}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {unreadCount > 0 && (
                            <TouchableOpacity onPress={handleMarkAllRead} style={[styles.iconButton, { backgroundColor: accentColor + '20' }]}>
                                <Ionicons name="checkmark-done" size={20} color={accentColor} />
                            </TouchableOpacity>
                        )}
                        {notifications.length > 0 && (
                            <TouchableOpacity onPress={handleClearAll} style={[styles.iconButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* List */}
                <ScrollView style={styles.listContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {notifications.length === 0 ? (
                        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
                            <VoidCard glass style={styles.emptyCard}>
                                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: accentColor + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <Ionicons name="notifications-off-outline" size={32} color={accentColor + '50'} />
                                </View>
                                <Text style={[styles.emptyText, { color: colors.textPrimary }]}>All Clear!</Text>
                                <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                                    You don't have any notifications.{'\n'}We'll alert you when something happens.
                                </Text>
                            </VoidCard>
                        </Animated.View>
                    ) : (
                        grouped.map((group, groupIndex) => (
                            <View key={group.label} style={{ marginBottom: 16 }}>
                                {/* Section Header */}
                                <View style={styles.sectionHeader}>
                                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: accentColor, marginRight: 8 }} />
                                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                                        {group.label.toUpperCase()}
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
                                                        <Animated.View style={{ transform: [{ translateX: trans }], width: '100%', height: '100%' }}>
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
                                                        </Animated.View>
                                                    </View>
                                                );
                                            }}
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
                                                            <Text style={[styles.notificationTitle, { color: colors.text, fontWeight: notification.read ? '500' : '700' }]} numberOfLines={1}>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
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
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    subtitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 4,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        fontFamily: 'Lexend_400Regular',
    },
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
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    emptySubtext: {
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 18,
        fontFamily: 'Lexend_400Regular',
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
        fontFamily: 'Lexend_400Regular',
    },
    unreadDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginLeft: 8,
    },
    notificationMessage: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
        lineHeight: 16,
    },
    notificationTime: {
        fontSize: 9,
        fontFamily: 'Lexend_400Regular',
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
        fontFamily: 'Lexend_600SemiBold',
    },
});
