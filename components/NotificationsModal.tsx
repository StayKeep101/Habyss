import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Dimensions, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolation,
    FadeInDown,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { NotificationService, InAppNotification } from '@/lib/notificationService';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;
const DRAG_THRESHOLD = 100;
const BOTTOM_PADDING = 100;

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
    const [isOpen, setIsOpen] = useState(false);

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
        backdropOpacity.value = withTiming(1, { duration: 300 });
    }, []);

    const closeModal = useCallback(() => {
        translateY.value = withSpring(SHEET_HEIGHT, { damping: 20, stiffness: 300 });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        setTimeout(() => {
            setIsOpen(false);
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        if (visible && !isOpen) {
            openModal();
            loadNotifications();
        } else if (!visible && isOpen) {
            closeModal();
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
            case 'info':
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
            { text: 'Clear All', style: 'destructive', onPress: async () => { await NotificationService.clearAllNotifications(); setNotifications([]); closeModal(); } }
        ]);
    };

    const handleNotificationPress = async (id: string) => {
        selectionFeedback();
        await NotificationService.markNotificationRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const panGesture = Gesture.Pan()
        .onUpdate((event) => { if (event.translationY > 0) translateY.value = event.translationY; })
        .onEnd((event) => {
            if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) runOnJS(closeModal)();
            else translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        });

    const sheetAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP) }));
    const handleIndicatorStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, 50], [1, 0.5], Extrapolation.CLAMP) }));

    if (!isOpen && !visible) return null;

    return (
        <Modal visible={isOpen || visible} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
            <View style={styles.container}>
                <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                </Animated.View>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeModal} />
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
                        <LinearGradient colors={['#1a1f2e', '#0a0d14']} style={[StyleSheet.absoluteFill, { height: SHEET_HEIGHT + BOTTOM_PADDING }]} />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder, { height: SHEET_HEIGHT + BOTTOM_PADDING }]} />

                        <Animated.View style={[styles.handleContainer, handleIndicatorStyle]}>
                            <View style={styles.handle} />
                        </Animated.View>

                        <View style={styles.header}>
                            <View>
                                <Text style={styles.headerTitle}>Notifications</Text>
                                {unreadCount > 0 && <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>}
                            </View>
                        </View>

                        <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: BOTTOM_PADDING }} showsVerticalScrollIndicator={false}>
                            {notifications.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.2)" />
                                    <Text style={styles.emptyText}>No notifications</Text>
                                    <Text style={styles.emptySubtext}>You're all caught up!</Text>
                                </View>
                            ) : (
                                notifications.map((notification, index) => (
                                    <Animated.View key={notification.id} entering={FadeInDown.delay(index * 50).duration(300)}>
                                        <TouchableOpacity onPress={() => handleNotificationPress(notification.id)} style={[styles.notificationItem, !notification.read && styles.unreadItem]}>
                                            <View style={[styles.iconContainer, { backgroundColor: getTypeColor(notification.type) + '20' }]}>
                                                <Ionicons name={notification.icon as any} size={20} color={getTypeColor(notification.type)} />
                                            </View>
                                            <View style={styles.contentContainer}>
                                                <View style={styles.titleRow}>
                                                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                                                    {!notification.read && <View style={styles.unreadDot} />}
                                                </View>
                                                <Text style={styles.notificationMessage}>{notification.message}</Text>
                                                <Text style={styles.notificationTime}>{formatTimeAgo(notification.timestamp)}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </Animated.View>
                                ))
                            )}
                        </ScrollView>

                        {notifications.length > 0 && (
                            <View style={styles.actionsRow}>
                                <TouchableOpacity style={[styles.actionButton, unreadCount === 0 && styles.actionDisabled]} onPress={handleMarkAllRead} disabled={unreadCount === 0}>
                                    <Ionicons name="checkmark-done" size={16} color={unreadCount > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'} style={{ marginRight: 6 }} />
                                    <Text style={[styles.actionText, unreadCount === 0 && { color: 'rgba(255,255,255,0.2)' }]}>Mark all read</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionButton, styles.actionButtonDanger]} onPress={handleClearAll}>
                                    <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                                    <Text style={styles.actionTextDanger}>Clear All</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT + BOTTOM_PADDING, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(139, 92, 246, 0.3)', pointerEvents: 'none' },
    handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
    header: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
    headerSubtitle: { fontSize: 12, color: '#2DD4BF', marginTop: 2, textAlign: 'center' },
    listContainer: { flex: 1 },
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginTop: 12 },
    emptySubtext: { fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 4 },
    notificationItem: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
    unreadItem: { backgroundColor: 'rgba(255,255,255,0.02)' },
    iconContainer: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    contentContainer: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    notificationTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2DD4BF', marginLeft: 8 },
    notificationMessage: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
    notificationTime: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
    actionsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    actionButton: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
    actionDisabled: { opacity: 0.5 },
    actionButtonDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    actionText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
    actionTextDanger: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
});
