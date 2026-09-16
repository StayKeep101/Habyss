import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { FriendsService } from '@/lib/friendsService';
import * as Haptics from 'expo-haptics';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { SheetSection } from '@/components/Layout/SheetSection';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface AddFriendModalProps {
    visible: boolean;
    onClose: () => void;
    userCode: string;
    onFriendAdded: () => void;
}

const { width } = Dimensions.get('window');

type Tab = 'code' | 'qr' | 'scan';

export const AddFriendModal: React.FC<AddFriendModalProps> = ({ visible, onClose, userCode, onFriendAdded }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('code');
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (visible && activeTab === 'scan') {
            setScanned(false);
            if (!permission?.granted) {
                requestPermission();
            }
        }
    }, [visible, activeTab]);

    const handleAddFriend = async (friendCode: string = code) => {
        const trimmed = friendCode.trim();
        if (trimmed.length < 3) {
            Alert.alert('Invalid Code', 'Enter a friend code or username (at least 3 characters).');
            return;
        }

        setLoading(true);
        try {
            const results = await FriendsService.searchUsers(trimmed);
            const normalizedQuery = trimmed.toLowerCase();
            const target = results.find((user) => {
                const friendCodeValue = user.id.slice(0, 8).toLowerCase();
                return (
                    user.id.toLowerCase() === normalizedQuery ||
                    friendCodeValue === normalizedQuery ||
                    user.username.toLowerCase() === normalizedQuery
                );
            }) || results[0];

            if (!target) {
                Alert.alert('Not Found', 'No one found with that code or username. Try searching by name instead.');
                setLoading(false);
                return;
            }

            const success = await FriendsService.sendFriendRequest(target.id);
            if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Connected!', `You and ${target.username} are now friends.`);
                setCode('');
                onFriendAdded();
                onClose();
            } else {
                Alert.alert('Already Connected', 'You are already friends or have a pending request.');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not search for friend.');
        } finally {
            setLoading(false);
            if (activeTab === 'scan') {
                setTimeout(() => setScanned(false), 2000);
            }
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

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Try parsing JSON if it's our format, otherwise treat as raw code
        let friendCode = data;
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'friend' && parsed.code) {
                friendCode = parsed.code;
            }
        } catch (e) {
            // Not JSON, assume raw code
        }

        Alert.alert(
            "Friend Detected",
            `Add friend with code: ${friendCode}?`,
            [
                { text: "Cancel", onPress: () => setScanned(false), style: "cancel" },
                { text: "Add Friend", onPress: () => handleAddFriend(friendCode) }
            ]
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'qr':
                return (
                    <View style={styles.qrContainer}>
                        <View style={[styles.qrWrapper, { backgroundColor: 'white' }]}>
                            <QRCode
                                value={JSON.stringify({ type: 'friend', code: userCode })}
                                size={200}
                                color="black"
                                backgroundColor="white"
                            />
                        </View>
                        <Text style={[styles.qrLabel, { color: colors.textSecondary }]}>
                            Ask your friend to scan this code
                        </Text>
                    </View>
                );
            case 'scan':
                if (!permission) return <View />;
                if (!permission.granted) {
                    return (
                        <View style={styles.centerContainer}>
                            <Text style={{ color: colors.text, textAlign: 'center', marginBottom: 20 }}>Camera permission is required to scan QR codes.</Text>
                            <TouchableOpacity onPress={requestPermission} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
                                <Text style={styles.addBtnText}>Grant Permission</Text>
                            </TouchableOpacity>
                        </View>
                    );
                }
                return (
                    <View style={styles.cameraContainer}>
                        <CameraView
                            style={StyleSheet.absoluteFill}
                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr"],
                            }}
                        />
                        <View style={styles.scanOverlay}>
                            <View style={styles.scanFrame} />
                        </View>
                        {scanned && (
                            <View style={styles.scanningOverlay}>
                                <ActivityIndicator color="#fff" size="large" />
                            </View>
                        )}
                    </View>
                );
            case 'code':
            default:
                return (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                        style={{ flex: 1 }}
                    >
                        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            <SheetSection
                                first
                                title="Your identifier"
                                description="Share this code so someone can add you to their crew."
                                style={{ marginBottom: 10 }}
                            />
                            <VoidCard style={styles.codeCard}>
                                <Text style={[styles.code, { color: colors.primary }]}>{userCode || 'LOADING...'}</Text>
                                <TouchableOpacity onPress={handleShare} style={[styles.copyBtn, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Ionicons name="share-outline" size={16} color={colors.textPrimary} />
                                    <Text style={[styles.copyText, { color: colors.textPrimary }]}>SHARE</Text>
                                </TouchableOpacity>
                            </VoidCard>

                            <View style={{ height: 20 }} />

                            <SheetSection
                                title="Enter friend code"
                                description="Paste the code a friend shared with you."
                                style={{ marginTop: 0, marginBottom: 10 }}
                            />
                            <TextInput
                                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}
                                placeholder="Code or username..."
                                placeholderTextColor={colors.textTertiary}
                                value={code}
                                onChangeText={text => setCode(text.toUpperCase())}
                                autoCapitalize="characters"
                                maxLength={36}
                            />

                            {/* Action Button */}
                            <TouchableOpacity
                                onPress={() => handleAddFriend()}
                                disabled={loading || code.trim().length < 3}
                                style={[
                                    styles.addBtn,
                                    {
                                        backgroundColor: loading || code.trim().length < 3 ? colors.surfaceTertiary : colors.primary,
                                        opacity: loading || code.trim().length < 3 ? 0.5 : 1
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
                );
        }
    };

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <View style={{ flex: 1 }}>
                <ModalHeader title="Add Crew" subtitle="INVITE FRIENDS" onBack={onClose} />

                {/* Tabs */}
                <View style={[styles.tabContainer, { borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'code' && { backgroundColor: colors.surfaceSecondary }]}
                        onPress={() => setActiveTab('code')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'code' ? colors.text : colors.textTertiary }]}>Enter Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'qr' && { backgroundColor: colors.surfaceSecondary }]}
                        onPress={() => setActiveTab('qr')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'qr' ? colors.text : colors.textTertiary }]}>My QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'scan' && { backgroundColor: colors.surfaceSecondary }]}
                        onPress={() => setActiveTab('scan')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'scan' ? colors.text : colors.textTertiary }]}>Scan</Text>
                    </TouchableOpacity>
                </View>

                {renderContent()}
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
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
    // New Styles
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        borderBottomWidth: 1,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabText: {
        fontWeight: '700',
        fontFamily: 'Lexend',
        fontSize: 12,
    },
    qrContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    qrWrapper: {
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    qrLabel: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
    },
    cameraContainer: {
        flex: 1,
        marginHorizontal: 20,
        marginBottom: 40,
        borderRadius: 20,
        overflow: 'hidden',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    scanOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanFrame: {
        width: 200,
        height: 200,
        borderWidth: 2,
        borderColor: 'white',
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    scanningOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    }
});
