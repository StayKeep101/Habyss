import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Dimensions, Alert } from 'react-native';
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
    FadeInDown,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { NotificationService, InAppNotification } from '@/lib/notificationService';
import { VoidCard } from '@/components/Layout/VoidCard';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;
const DRAG_THRESHOLD = 100;

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
    const contentOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 300 });
        contentOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    }, []);

    const closeModal = useCallback(() => {
        contentOpacity.value = withTiming(0, { duration: 150 });
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        setTimeout(() => { setIsOpen(false); onClose(); }, 300);
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

                        <View style={styles.header}>
                            <TouchableOpacity onPress={closeModal} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.title}>NOTIFICATIONS</Text>
                                <Text style={[styles.subtitle, { color: '#2DD4BF' }]}>{unreadCount > 0 ? `${unreadCount} UNREAD` : 'ALL CAUGHT UP'}</Text>
                            </View>
                            {unreadCount > 0 && (
                                <TouchableOpacity onPress={handleMarkAllRead} style={[styles.iconButton, { backgroundColor: 'rgba(45, 212, 191, 0.2)' }]}>
                                    <Ionicons name="checkmark-done" size={20} color="#2DD4BF" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={styles.listContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            <Animated.View style={contentStyle}>
                                {notifications.length === 0 ? (
                                    <VoidCard glass style={styles.emptyCard}>
                                        <Ionicons name="notifications-off-outline" size={40} color="rgba(255,255,255,0.2)" />
                                        <Text style={styles.emptyText}>No notifications</Text>
                                        <Text style={styles.emptySubtext}>You're all caught up!</Text>
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
                                                            <Text style={styles.notificationTitle}>{notification.title}</Text>
                                                            {!notification.read && <View style={styles.unreadDot} />}
                                                        </View>
                                                        <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message}</Text>
                                                        <Text style={styles.notificationTime}>{formatTimeAgo(notification.timestamp)}</Text>
                                                    </View>
                                                </VoidCard>
                                            </TouchableOpacity>
                                        </Animated.View>
                                    ))
                                )}
                            </Animated.View>
                        </ScrollView>

                        {notifications.length > 0 && (
                            <View style={styles.actionsRow}>
                                <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
                                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                    <Text style={styles.clearText}>Clear All</Text>
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
    sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 0, borderBottomWidth: 0, borderColor: 'transparent', pointerEvents: 'none' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: 'Lexend' },
    subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    listContainer: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
    emptyCard: { alignItems: 'center', padding: 40 },
    emptyText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginTop: 12 },
    emptySubtext: { fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 4 },
    notificationItem: { flexDirection: 'row', padding: 14, marginBottom: 8 },
    unreadItem: { borderLeftWidth: 3, borderLeftColor: '#2DD4BF' },
    notifIconContainer: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    notifContent: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    notificationTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2DD4BF', marginLeft: 8 },
    notificationMessage: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
    notificationTime: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Lexend_400Regular' },
    actionsRow: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    clearButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', gap: 8 },
    clearText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
});
