import { FontFamily } from '@/theme/designSystem';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Share, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { MatteInput } from '@/components/ui/MatteInput';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { VoidCard } from '@/components/ui/VoidCard';
import { addFriendByUsername, inviteLink, inviteMessage, usernameFrom } from '@/lib/friendsService';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { SheetSection } from '@/components/ui/SheetSection';
import { Segmented } from '@/components/ui/Segmented';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface AddFriendModalProps {
    visible: boolean;
    onClose: () => void;
    userCode: string;
    onFriendAdded: () => void;
}


type Tab = 'code' | 'qr' | 'scan';

export const AddFriendModal: React.FC<AddFriendModalProps> = ({ visible, onClose, userCode, onFriendAdded }) => {
    // Through the hook rather than expo-haptics directly. A bare
    // notificationAsync call drops a promise that rejects where there is no
    // haptic engine, which React Native raises as a red screen, and it buzzes
    // even for somebody who has turned haptics off in Settings.
    const { successFeedback, errorFeedback } = useHaptics();
    const { theme } = useTheme();
    const colors = Colors[theme];
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
                            <AppButton label="Allow camera" onPress={requestPermission} />
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
                                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.code, { color: colors.textPrimary }]}>{userCode ? `@${userCode}` : '…'}</Text>
                                <AppButton label="Share" icon="share" onPress={handleShare} fullWidth={false} />
                            </VoidCard>

                            <View style={{ height: 20 }} />

                            <SheetSection
                                title="Add a friend"
                                description="Their username or invite link."
                                style={{ marginTop: 0, marginBottom: 10 }}
                            />
                            <MatteInput
                                style={styles.input}
                                placeholder="Username"
                                placeholderTextColor={colors.textTertiary}
                                value={code}
                                onChangeText={setCode}
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={120}
                            />

                            <AppButton label="Add friend" icon="person-add" loading={loading}
                                disabled={loading || code.trim().length < 3} onPress={() => handleAddFriend()} />
                        </ScrollView>
                    </KeyboardAvoidingView>
                );
        }
    };

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <View style={{ flex: 1 }}>
                <ModalHeader title="Add friends" onBack={onClose} />

                <View style={styles.tabs}>
                    <Segmented accessibilityLabel="How to add a friend" value={activeTab} onChange={setActiveTab}
                        options={[{ id: 'code', label: 'Username' }, { id: 'qr', label: 'My code' }, { id: 'scan', label: 'Scan' }]} />
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
    codeCard: { padding: 20, alignItems: 'center', justifyContent: 'center', gap: 14 },
    code: { fontSize: 26, fontFamily: FontFamily.bold, letterSpacing: -0.3 },
    input: { marginBottom: 16 },
    tabs: { marginHorizontal: 20, marginBottom: 12 },
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
