import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Dimensions, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import * as Haptics from 'expo-haptics';

interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    icon: string;
    read: boolean;
    type: 'success' | 'info' | 'warning' | 'habit';
}

interface NotificationsModalProps {
    visible: boolean;
    onClose: () => void;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
    {
        id: '1',
        title: 'Streak Achievement!',
        message: 'You completed a 7-day streak on "Morning Meditation"',
        time: '2 min ago',
        icon: 'flame',
        read: false,
        type: 'success'
    },
    {
        id: '2',
        title: 'Daily Reminder',
        message: 'Time for your evening workout session',
        time: '15 min ago',
        icon: 'fitness',
        read: false,
        type: 'habit'
    },
    {
        id: '3',
        title: 'Weekly Report Ready',
        message: 'Your weekly progress summary is available',
        time: '1 hour ago',
        icon: 'stats-chart',
        read: true,
        type: 'info'
    },
    {
        id: '4',
        title: "Don't break your streak!",
        message: 'You haven\'t completed "Read 30 mins" today',
        time: '3 hours ago',
        icon: 'alert-circle',
        read: true,
        type: 'warning'
    },
    {
        id: '5',
        title: 'New Goal Unlocked',
        message: 'You\'ve earned the "Consistent" badge',
        time: 'Yesterday',
        icon: 'trophy',
        read: true,
        type: 'success'
    }
];

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ visible, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

    const unreadCount = notifications.filter(n => !n.read).length;

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'success': return '#A3E635';
            case 'warning': return '#F59E0B';
            case 'habit': return '#2DD4BF';
            case 'info':
            default: return colors.primary;
        }
    };

    const handleMarkAllRead = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleClearAll = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Clear All Notifications',
            'Are you sure you want to remove all notifications?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: () => {
                        setNotifications([]);
                        onClose();
                    }
                }
            ]
        );
    };

    const handleNotificationPress = (id: string) => {
        Haptics.selectionAsync();
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <Animated.View
                    entering={FadeInDown.duration(300)}
                    exiting={FadeOutUp.duration(200)}
                    style={styles.modalContainer}
                >
                    <TouchableOpacity activeOpacity={1}>
                        <BlurView intensity={80} tint="dark" style={styles.modalContent}>
                            {/* Header */}
                            <View style={styles.header}>
                                <View>
                                    <Text style={styles.headerTitle}>NOTIFICATIONS</Text>
                                    {unreadCount > 0 && (
                                        <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                    <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
                                </TouchableOpacity>
                            </View>

                            {/* Notifications List - Scrollable */}
                            <ScrollView
                                style={styles.listContainer}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={true}
                                bounces={true}
                            >
                                {notifications.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.2)" />
                                        <Text style={styles.emptyText}>No notifications</Text>
                                        <Text style={styles.emptySubtext}>You're all caught up!</Text>
                                    </View>
                                ) : (
                                    notifications.map((notification, index) => (
                                        <Animated.View
                                            key={notification.id}
                                            entering={FadeInDown.delay(index * 50).duration(300)}
                                        >
                                            <TouchableOpacity
                                                onPress={() => handleNotificationPress(notification.id)}
                                                style={[
                                                    styles.notificationItem,
                                                    !notification.read && styles.unreadItem
                                                ]}
                                            >
                                                <View style={[styles.iconContainer, { backgroundColor: getTypeColor(notification.type) + '20' }]}>
                                                    <Ionicons
                                                        name={notification.icon as any}
                                                        size={20}
                                                        color={getTypeColor(notification.type)}
                                                    />
                                                </View>
                                                <View style={styles.contentContainer}>
                                                    <View style={styles.titleRow}>
                                                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                                                        {!notification.read && <View style={styles.unreadDot} />}
                                                    </View>
                                                    <Text style={styles.notificationMessage}>{notification.message}</Text>
                                                    <Text style={styles.notificationTime}>{notification.time}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        </Animated.View>
                                    ))
                                )}
                            </ScrollView>

                            {/* Actions */}
                            {notifications.length > 0 && (
                                <View style={styles.actionsRow}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, unreadCount === 0 && styles.actionDisabled]}
                                        onPress={handleMarkAllRead}
                                        disabled={unreadCount === 0}
                                    >
                                        <Ionicons name="checkmark-done" size={16} color={unreadCount > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'} style={{ marginRight: 6 }} />
                                        <Text style={[styles.actionText, unreadCount === 0 && { color: 'rgba(255,255,255,0.2)' }]}>Mark all read</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionButton, styles.actionButtonDanger]} onPress={handleClearAll}>
                                        <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                                        <Text style={styles.actionTextDanger}>Clear All</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </BlurView>
                    </TouchableOpacity>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-start',
        paddingTop: 100,
    },
    modalContainer: {
        marginHorizontal: 16,
        maxHeight: height * 0.7,
    },
    modalContent: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 2,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#2DD4BF',
        fontFamily: 'SpaceMono-Regular',
        marginTop: 2,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContainer: {
        maxHeight: height * 0.45,
    },
    listContent: {
        paddingVertical: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.4)',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.2)',
        marginTop: 4,
        fontFamily: 'SpaceMono-Regular',
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.03)',
    },
    unreadItem: {
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    contentContainer: {
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
        color: '#fff',
        fontFamily: 'SpaceGrotesk-Bold',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#2DD4BF',
        marginLeft: 8,
    },
    notificationMessage: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        fontFamily: 'SpaceMono-Regular',
        marginBottom: 4,
    },
    notificationTime: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.3)',
        fontFamily: 'SpaceMono-Regular',
    },
    actionsRow: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    actionDisabled: {
        opacity: 0.5,
    },
    actionButtonDanger: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    actionText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'SpaceGrotesk-Bold',
    },
    actionTextDanger: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'SpaceGrotesk-Bold',
    },
});
