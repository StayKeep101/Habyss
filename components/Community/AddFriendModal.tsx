import { FontFamily } from '@/theme/designSystem';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { VoidCard } from '@/components/ui/VoidCard';
import { addFriendByUsername, inviteLink, inviteMessage, usernameFrom } from '@/lib/friendsService';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { SheetSection } from '@/components/ui/SheetSection';
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
    // Through the hook rather than expo-haptics directly. A bare
    // notificationAsync call drops a promise that rejects where there is no
    // haptic engine, which React Native raises as a red screen, and it buzzes
    // even for somebody who has turned haptics off in Settings.
    const { successFeedback, errorFeedback } = useHaptics();
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
        if (!usernameFrom(friendCode)) {
            Alert.alert('Not a username', 'Usernames are 3 to 20 letters, numbers, dots or underscores.');
            if (activeTab === 'scan') setTimeout(() => setScanned(false), 2000);
            return;
        }

        setLoading(true);
        try {
            const result = await addFriendByUsername(friendCode);
            if (!result.ok) {
                Alert.alert('Not added', result.error);
                return;
            }
            successFeedback();
            Alert.alert(
                result.nowFriends ? 'Friends' : 'Request sent',
                result.nowFriends
                    ? `You and @${result.username} are now friends.`
                    : `@${result.username} will see your request next time they open Habyss.`,
            );
            setCode('');
            onFriendAdded();
            onClose();
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not reach Habyss. Check your connection.');
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
                message: inviteMessage(userCode),
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);

        const friendCode = usernameFrom(data);
        if (!friendCode) {
            // It used to offer to add whatever the code happened to contain, so
            // scanning a bus timetable proposed adding @https://…
            errorFeedback();
            Alert.alert(
                'Not a Habyss code',
                'That is some other kind of QR code. Ask your friend for the one in their Add friend screen.',
                [{ text: 'OK', onPress: () => setScanned(false) }],
            );
            return;
        }

        successFeedback();
        Alert.alert(
            'Friend found',
            `Add @${friendCode}?`,
            [
                { text: 'Cancel', onPress: () => setScanned(false), style: 'cancel' },
                { text: 'Add friend', onPress: () => handleAddFriend(friendCode) },
            ],
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'qr':
                // Without a username the link would be `?u=` — a code that
                // cannot be scanned into anything.
                if (!usernameFrom(userCode)) {
                    return (
                        <View style={styles.qrContainer}>
                            <Text style={[styles.qrLabel, { color: colors.textSecondary }]}>
                                Choose a username first — it is what your code points at.
                            </Text>
                        </View>
                    );
                }
                return (
                    <View style={styles.qrContainer}>
                        <View style={[styles.qrWrapper, { backgroundColor: 'white' }]}>
                            <QRCode
                                value={inviteLink(userCode)}
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
                                title="Your username"
                                description="Friends add you with it."
                                style={{ marginBottom: 10 }}
                            />
                            <VoidCard style={styles.codeCard}>
                                <Text style={[styles.code, { color: colors.primary }]}>{userCode ? `@${userCode}` : '…'}</Text>
                                <TouchableOpacity onPress={handleShare} style={[styles.copyBtn, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Ionicons name="share-outline" size={16} color={colors.textPrimary} />
                                    <Text style={[styles.copyText, { color: colors.textPrimary }]}>SHARE</Text>
                                </TouchableOpacity>
                            </VoidCard>

                            <View style={{ height: 20 }} />

                            <SheetSection
                                title="Add a friend"
                                description="Their username or invite link."
                                style={{ marginTop: 0, marginBottom: 10 }}
                            />
                            <MatteInput
                                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}
                                placeholder="username"
                                placeholderTextColor={colors.textTertiary}
                                value={code}
                                onChangeText={setCode}
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={120}
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
                        <Text style={[styles.tabText, { color: activeTab === 'code' ? colors.text : colors.textTertiary }]}>Username</Text>
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
        letterSpacing: 4,
        marginBottom: 12,
        fontFamily: FontFamily.display,
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
        letterSpacing: 1,
        fontFamily: FontFamily.bold,
    },
    input: {
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 18,
        fontFamily: FontFamily.display,
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
        color: '#fff',
        letterSpacing: 1,
        fontFamily: FontFamily.bold,
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

        fontFamily: FontFamily.bold,
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
        fontFamily: FontFamily.regular,
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
