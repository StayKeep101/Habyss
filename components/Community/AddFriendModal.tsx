import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { FriendsService } from '@/lib/friendsService';
import * as Haptics from 'expo-haptics';
import { VoidModal } from '@/components/Layout/VoidModal';

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
                onClose();
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
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.85}>
            <View style={{ flex: 1 }}>
                {/* Header - styled like StreakModal */}
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.title, { color: colors.text }]}>ADD CREW</Text>
                        <Text style={[styles.subtitle, { color: colors.primary }]}>INVITE FRIENDS</Text>
                    </View>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {/* Your Code Section */}
                        <Text style={[styles.label, { color: colors.textSecondary }]}>YOUR IDENTIFIER</Text>
                        <VoidCard style={styles.codeCard}>
                            <Text style={[styles.code, { color: colors.primary }]}>{userCode || 'LOADING...'}</Text>
                            <TouchableOpacity onPress={handleShare} style={[styles.copyBtn, { backgroundColor: colors.surfaceSecondary }]}>
                                <Ionicons name="share-outline" size={16} color={colors.textPrimary} />
                                <Text style={[styles.copyText, { color: colors.textPrimary }]}>SHARE</Text>
                            </TouchableOpacity>
                        </VoidCard>

                        <View style={{ height: 20 }} />

                        {/* Enter Friend Code */}
                        <Text style={[styles.label, { color: colors.textSecondary }]}>ENTER FRIEND CODE</Text>
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
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    modalHeader: {
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
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 40,
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
