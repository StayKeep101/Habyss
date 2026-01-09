import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share, Dimensions, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { FriendsService } from '@/lib/friendsService';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.55;
const DRAG_THRESHOLD = 100;

interface AddFriendModalProps {
    visible: boolean;
    onClose: () => void;
    userCode: string;
    onFriendAdded: () => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({ visible, onClose, userCode, onFriendAdded }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
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
        } else if (!visible && isOpen) {
            closeModal();
        }
    }, [visible]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const contentStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
    }));

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            if (e.translationY > 0) {
                translateY.value = e.translationY;
            }
        })
        .onEnd((e) => {
            if (e.translationY > DRAG_THRESHOLD) {
                runOnJS(closeModal)();
            } else {
                translateY.value = withTiming(0, { duration: 200 });
            }
        });

    const handleAddFriend = async () => {
        if (code.length < 8) {
            Alert.alert('Invalid Code', 'Friend codes are at least 8 characters long.');
            return;
        }

        setLoading(true);
        try {
            const results = await FriendsService.searchUsers(code);
            const lowerCode = code.toLowerCase();
            const target = results.find(u => u.id.toLowerCase().startsWith(lowerCode) || u.username.toLowerCase() === lowerCode);

            if (!target) {
                Alert.alert('Not Found', 'No explorer found with this code.');
                setLoading(false);
                return;
            }

            const success = await FriendsService.sendFriendRequest(target.id);
            if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Signal Sent! 📡', `Friend request sent to ${target.username}.`);
                setCode('');
                onFriendAdded();
                closeModal();
            } else {
                Alert.alert('Connection Failed', 'Request already pending or you are already friends.');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not search for friend.');
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Join my crew on Habyss! Add me with my Friend Code: ${userCode}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Modal visible={isOpen || visible} transparent animationType="none" onRequestClose={closeModal}>
            <View style={styles.container}>
                {/* Backdrop */}
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeModal} activeOpacity={1} />
                </Animated.View>

                {/* Sheet */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetStyle]}>
                        <LinearGradient
                            colors={['#0f1218', '#080a0e']}
                            style={styles.sheetGradient}
                        >
                            {/* Drag Handle */}
                            <View style={styles.handleContainer}>
                                <View style={[styles.handle, { backgroundColor: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)' }]} />
                            </View>

                            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
                                    <Animated.View style={[styles.content, contentStyle]}>
                                        {/* Header */}
                                        <Text style={[styles.title, { color: '#fff' }]}>ADD CREW MEMBER</Text>

                                        {/* Your Code Section */}
                                        <Text style={[styles.label, { color: 'rgba(255,255,255,0.7)' }]}>YOUR IDENTIFIER</Text>
                                        <VoidCard style={styles.codeCard}>
                                            <Text style={[styles.code, { color: colors.primary }]}>{userCode || 'LOADING...'}</Text>
                                            <TouchableOpacity onPress={handleShare} style={[styles.copyBtn, { backgroundColor: colors.surfaceSecondary }]}>
                                                <Ionicons name="share-outline" size={16} color={colors.textPrimary} />
                                                <Text style={[styles.copyText, { color: colors.textPrimary }]}>SHARE</Text>
                                            </TouchableOpacity>
                                        </VoidCard>

                                        <View style={{ height: 20 }} />

                                        {/* Enter Friend Code */}
                                        <Text style={[styles.label, { color: 'rgba(255,255,255,0.7)' }]}>ENTER FRIEND CODE</Text>
                                        <TextInput
                                            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}
                                            placeholder="e.g. A1B2C3D4"
                                            placeholderTextColor={colors.textTertiary}
                                            value={code}
                                            onChangeText={text => setCode(text.toUpperCase())}
                                            autoCapitalize="characters"
                                            maxLength={36}
                                        />

                                        {/* Action Button */}
                                        <TouchableOpacity
                                            onPress={handleAddFriend}
                                            disabled={loading || code.length < 3}
                                            style={[
                                                styles.addBtn,
                                                {
                                                    backgroundColor: loading || code.length < 3 ? colors.surfaceTertiary : colors.primary,
                                                    opacity: loading || code.length < 3 ? 0.5 : 1
                                                }
                                            ]}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <Text style={styles.addBtnText}>ADD FRIEND</Text>
                                            )}
                                        </TouchableOpacity>
                                    </Animated.View>
                                </KeyboardAvoidingView>
                            </ScrollView>
                        </LinearGradient>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SHEET_HEIGHT,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },
    sheetGradient: {
        flex: 1,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: 'Lexend',
        textAlign: 'center',
        marginBottom: 20,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        fontFamily: 'Lexend_400Regular',
    },
    codeCard: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    code: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: 4,
        marginBottom: 12,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    copyText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    input: {
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 2,
        marginBottom: 20,
    },
    addBtn: {
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addBtnText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
});
