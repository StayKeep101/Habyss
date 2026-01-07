import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { FriendsService } from '@/lib/friendsService';
import * as Haptics from 'expo-haptics';

interface AddFriendModalProps {
    visible: boolean;
    onClose: () => void;
    userCode: string; // Current user's code
    onFriendAdded: () => void; // Refresh list
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({ visible, onClose, userCode, onFriendAdded }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAddFriend = async () => {
        if (code.length < 8) {
            Alert.alert('Invalid Code', 'Friend codes are at least 8 characters long.');
            return;
        }

        setLoading(true);
        try {
            // 1. Search for user by code (ID prefix)
            const results = await FriendsService.searchUsers(code);

            // Filter out self
            const target = results.find(u => u.id.startsWith(code) || u.username === code);

            if (!target) {
                Alert.alert('Not Found', 'No explorer found with this code.');
                setLoading(false);
                return;
            }

            // 2. Send Request
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
        <Modal
            animationType="slide"
            presentationStyle="pageSheet"
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: '#121212' }]}>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>ADD CREW MEMBER</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <View style={{ padding: 20 }}>
                    {/* Your Code Section */}
                    <Text style={[styles.label, { color: colors.textSecondary }]}>YOUR IDENTIFIER</Text>
                    <VoidCard style={styles.codeCard}>
                        <Text style={[styles.code, { color: colors.primary }]}>{userCode || 'LOADING...'}</Text>
                        <TouchableOpacity onPress={handleShare} style={[styles.copyBtn, { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name="share-outline" size={16} color={colors.textPrimary} />
                            <Text style={[styles.copyText, { color: colors.textPrimary }]}>SHARE</Text>
                        </TouchableOpacity>
                    </VoidCard>

                    <View style={{ height: 24 }} />

                    {/* Enter Friend Code */}
                    <Text style={[styles.label, { color: colors.textSecondary }]}>ENTER FRIEND CODE</Text>
                    <TextInput
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                        placeholder="e.g. A1B2C3D4"
                        placeholderTextColor={colors.textTertiary}
                        value={code}
                        onChangeText={text => setCode(text.toUpperCase())}
                        autoCapitalize="characters"
                        maxLength={36} // Full UUID support if pasted
                    />

                    {/* Action Button */}
                    <TouchableOpacity
                        onPress={handleAddFriend}
                        disabled={loading || code.length < 3}
                        style={[
                            styles.addBtn,
                            {
                                backgroundColor: loading || code.length < 3 ? colors.surfaceTertiary : '#FFFFFF',
                                opacity: loading || code.length < 3 ? 0.5 : 1
                            }
                        ]}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.addBtnText}>ADD FRIEND</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // pageSheet handles the rounding and presentation
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    closeBtn: {
        padding: 4,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        fontFamily: 'Lexend_400Regular',
    },
    codeCard: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    code: {
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: 4,
        marginBottom: 16,
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
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 2,
        marginBottom: 24,
    },
    addBtn: {
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    addBtnText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#000',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
});
