import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { IconButton } from '@/components/ui/IconButton';
import { MatteInput } from '@/components/ui/MatteInput';
import { VoidCard } from '@/components/ui/VoidCard';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing, Typography } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { addFriendByUsername, inviteLink, inviteMessage, usernameFrom } from '@/lib/friendsService';

interface AddFriendModalProps {
    visible: boolean;
    onClose: () => void;
    userCode: string;
    onFriendAdded: () => void;
}

// A QR code only scans dark on light, whatever the theme.
const QR_INK = 'black'; // ui-allow
const QR_PAPER = 'white'; // ui-allow

/**
 * Adding a friend, on one screen and with almost no words.
 *
 * It used to be three tabs, so what you came for was usually on another one.
 * Now: a field with a send arrow and a scan button beside it, and under that
 * your own code — QR, username, share — for when the other person adds you.
 */
export const AddFriendModal: React.FC<AddFriendModalProps> = ({ visible, onClose, userCode, onFriendAdded }) => {
    const { successFeedback, errorFeedback, lightFeedback } = useHaptics();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const hasUsername = !!usernameFrom(userCode);
    const ready = code.trim().length >= 3 && !loading;

    // It always opens on the field, never on a half-finished scan.
    useEffect(() => {
        if (!visible) { setScanning(false); setScanned(false); setError(null); }
    }, [visible]);

    const add = async (input: string = code) => {
        if (!usernameFrom(input)) {
            errorFeedback();
            setError('Not a username');
            setScanned(false);
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const result = await addFriendByUsername(input);
            if (!result.ok) {
                errorFeedback();
                setError(result.error);
                return;
            }
            successFeedback();
            Alert.alert(
                result.nowFriends ? 'Friends' : 'Request sent',
                result.nowFriends ? `You and @${result.username} are now friends.` : `@${result.username} will see it next time.`,
            );
            setCode('');
            setScanning(false);
            onFriendAdded();
            onClose();
        } catch (e) {
            console.error(e);
            setError('No connection');
        } finally {
            setLoading(false);
            setTimeout(() => setScanned(false), 1500);
        }
    };

    const share = async () => {
        lightFeedback();
        try { await Share.share({ message: inviteMessage(userCode) }); }
        catch (e) { console.error(e); }
    };

    const startScan = async () => {
        lightFeedback();
        setScanned(false);
        if (!permission?.granted) {
            const answer = await requestPermission();
            if (!answer.granted) {
                Alert.alert('Camera is off', 'Allow the camera for Habyss in Settings.');
                return;
            }
        }
        setScanning(true);
    };

    const onScan = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        const name = usernameFrom(data);
        if (!name) {
            // Only Habyss codes: a bus timetable is not a friend.
            errorFeedback();
            Alert.alert('Not a Habyss code', undefined, [{ text: 'OK', onPress: () => setScanned(false) }]);
            return;
        }
        successFeedback();
        Alert.alert(`Add @${name}?`, undefined, [
            { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
            { text: 'Add', onPress: () => void add(name) },
        ]);
    };

    return (
        // A sheet, not a whole page: three quarters of the screen at most, the
        // community still showing above it.
        <VoidSheet visible={visible} onClose={onClose} title={scanning ? 'Scan a code' : 'Add friends'} maxShare={0.75}>
            <View>

                {scanning ? (
                    <View style={styles.scanner}>
                        <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                            onBarcodeScanned={scanned ? undefined : onScan} />
                        <View pointerEvents="none" style={styles.frameWrap}>
                            <View style={[styles.frame, { borderColor: colors.textPrimary }]} />
                        </View>
                        {scanned ? (
                            <View style={styles.frameWrap}>
                                <ActivityIndicator color={colors.textPrimary} size="large" />
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View>
                        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            <View style={styles.addRow}>
                                <MatteInput
                                    style={styles.input}
                                    invalid={!!error}
                                    placeholder="Username"
                                    value={code}
                                    onChangeText={text => { setCode(text); if (error) setError(null); }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="send"
                                    onSubmitEditing={() => { if (ready) void add(); }}
                                    maxLength={120}
                                />
                                {ready || loading
                                    ? <IconButton icon="arrow-forward" label="Add friend" diameter={52} loading={loading} onPress={() => void add()} />
                                    : <IconButton icon="scan" label="Scan a friend's code" diameter={52} onPress={() => void startScan()} />}
                            </View>
                            {error ? <Text accessibilityRole="alert" style={[Typography.caption, styles.error, { color: colors.error }]}>{error}</Text> : null}

                            {hasUsername ? (
                                <VoidCard style={styles.mine}>
                                    <View style={[styles.qr, { backgroundColor: QR_PAPER }]}>
                                        <QRCode value={inviteLink(userCode)} size={160} color={QR_INK} backgroundColor={QR_PAPER} />
                                    </View>
                                    <View style={styles.nameRow}>
                                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.username, { color: colors.textPrimary }]}>@{userCode}</Text>
                                        <IconButton icon="share" label="Share invite" diameter={40} size={18} onPress={() => void share()} />
                                    </View>
                                </VoidCard>
                            ) : null}
                        </ScrollView>
                    </View>
                )}
            </View>
        </VoidSheet>
    );
};

const styles = StyleSheet.create({
    fill: { flex: 1 },
    content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, gap: Spacing.xl },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    input: { flex: 1, height: 52 },
    error: { marginTop: -Spacing.lg, marginLeft: Spacing.xs },
    mine: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.lg },
    qr: { padding: Spacing.md, borderRadius: Radius.small },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    username: { flexShrink: 1, fontSize: 20, fontFamily: FontFamily.bold, letterSpacing: -0.3 },
    scanner: { height: 320, marginHorizontal: Spacing.xl, marginVertical: Spacing.md, borderRadius: Radius.card, overflow: 'hidden' },
    frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    frame: { width: 200, height: 200, borderWidth: 2, borderRadius: Radius.small },
});
