import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { NotificationService, InAppNotification } from '@/lib/notificationService';
import { VoidCard } from '@/components/Layout/VoidCard';
import { VoidModal } from '@/components/Layout/VoidModal';

interface NotificationsModalProps {
    visible: boolean;
    onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ visible, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();

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

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'success': return '#A3E635';
            case 'warning': return '#F59E0B';
            case 'habit': return '#2DD4BF';
            case 'streak': return '#F97316';
            case 'achievement': return '#A855F7';
            case 'nudge': return '#3B82F6';
            case 'friend_request': return '#EC4899';
            case 'shared_habit': return '#10B981';
            default: return colors.primary;
        }
    };

    const formatTimeAgo = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} min ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days === 1) return 'Yesterday';
        return `${days} days ago`;
    };

    const handleMarkAllRead = async () => {
        lightFeedback();
        await NotificationService.markAllNotificationsRead();
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleClearAll = () => {
        mediumFeedback();
        Alert.alert('Clear All Notifications', 'Are you sure you want to remove all notifications?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear All', style: 'destructive', onPress: async () => { await NotificationService.clearAllNotifications(); setNotifications([]); onClose(); } }
        ]);
    };

    const handleNotificationPress = async (id: string) => {
        selectionFeedback();
        await NotificationService.markNotificationRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
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
                        <Text style={[styles.subtitle, { color: '#2DD4BF' }]}>{unreadCount > 0 ? `${unreadCount} UNREAD` : 'ALL CAUGHT UP'}</Text>
                    </View>
                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={handleMarkAllRead} style={[styles.iconButton, { backgroundColor: 'rgba(45, 212, 191, 0.2)' }]}>
                            <Ionicons name="checkmark-done" size={20} color="#2DD4BF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* List */}
                <ScrollView style={styles.listContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {notifications.length === 0 ? (
                        <VoidCard glass style={styles.emptyCard}>
                            <Ionicons name="notifications-off-outline" size={40} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications</Text>
                            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>You're all caught up!</Text>
                        </VoidCard>
                    ) : (
                        notifications.map((notification, index) => (
                            <Animated.View key={notification.id} entering={FadeInDown.delay(index * 30).duration(300)}>
                                <TouchableOpacity onPress={() => handleNotificationPress(notification.id)}>
                                    <VoidCard glass style={{ ...styles.notificationItem, ...(!notification.read ? styles.unreadItem : {}) }}>
                                        <View style={[styles.notifIconContainer, { backgroundColor: getTypeColor(notification.type) + '20' }]}>
                                            <Ionicons name={notification.icon as any} size={20} color={getTypeColor(notification.type)} />
                                        </View>
                                        <View style={styles.notifContent}>
                                            <View style={styles.titleRow}>
                                                <Text style={[styles.notificationTitle, { color: colors.text }]}>{notification.title}</Text>
                                                {!notification.read && <View style={styles.unreadDot} />}
                                            </View>
                                            <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>{notification.message}</Text>
                                            <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>{formatTimeAgo(notification.timestamp)}</Text>
                                        </View>
                                    </VoidCard>
                                </TouchableOpacity>
                            </Animated.View>
                        ))
                    )}
                </ScrollView>

                {notifications.length > 0 && (
                    <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
                        <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            <Text style={styles.clearText}>Clear All</Text>
                        </TouchableOpacity>
                    </View>
                )}
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
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 12,
        marginTop: 4,
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 14,
        marginBottom: 8,
    },
    unreadItem: {
        borderLeftWidth: 3,
        borderLeftColor: '#2DD4BF',
    },
    notifIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
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
        marginBottom: 4,
    },
    notificationTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#2DD4BF',
        marginLeft: 8,
    },
    notificationMessage: {
        fontSize: 12,
        marginBottom: 4,
    },
    notificationTime: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
    },
    actionsRow: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        gap: 8,
    },
    clearText: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '600',
    },
});
