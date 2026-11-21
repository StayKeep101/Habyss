import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, Text as RNText, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AppButton, IconButton, ShutterButton, Text, VoidSheet } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { setPhotoAsker } from '@/lib/challengeProof';
import { Colors } from '@/theme/colors';
import { Radius, Spacing } from '@/theme/designSystem';

/** How much of the screen the camera may take, so the sheet always fits, on an SE too. */
const FRAME_SHARE = 0.56;

/**
 * The proof camera (lib/challengeProof.ts): a tick that counts for a challenge
 * or a bet, and that nothing tracks by itself, opens it. A photo taken now, in
 * Habyss (no gallery), then Use it or Retake. Closing it leaves the tick undone.
 * Every other habit ticked by hand opens it too, skippable: Skip or closing it
 * keeps the tick, without a photo.
 *
 * Everything is on the camera itself, the way the Camera app does it: the
 * shutter at the bottom (or tap anywhere on the picture), flip beside it, Skip
 * in the corner; once taken, Retake and Use photo over the photo. Nothing sits
 * under it that a small screen could cut off.
 * Mounted once over the app.
 */
export function ProofCameraHost() {
    const t = useTokens();
    const { successFeedback, lightFeedback } = useHaptics();
    const { height } = useWindowDimensions();
    const [ask, setAsk] = useState<{ title: string; resolve: (uri: string | null) => void; optional?: boolean } | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [taking, setTaking] = useState(false);
    const [facing, setFacing] = useState<'back' | 'front'>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const camera = useRef<CameraView>(null);
    const white = Colors.common.white;

    useEffect(() => {
        setPhotoAsker(next => {
            setPhoto(null);
            setAsk(current => { current?.resolve(null); return next; });
        });
        return () => setPhotoAsker(null);
    }, []);

    useEffect(() => {
        if (!ask || permission?.granted) return;
        void requestPermission().then(answer => {
            if (answer.granted) return;
            // A photo you could skip anyway: no camera, no fuss; the tick stands.
            if (!ask.optional) Alert.alert('Camera is off for Habyss', 'Allow the camera in Settings → Apps → Habyss to prove this one.');
            finish(null);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ask, permission?.granted]);

    const finish = (uri: string | null) => {
        ask?.resolve(uri);
        setAsk(null);
        setPhoto(null);
    };

    const shoot = async () => {
        if (taking || !camera.current) return;
        lightFeedback();
        setTaking(true);
        try {
            const shot = await camera.current.takePictureAsync({ quality: 0.5, skipProcessing: false });
            if (shot?.uri) setPhoto(shot.uri);
        } catch { /* try again */ } finally { setTaking(false); }
    };

    const live = !photo && permission?.granted && !!ask;
    return (
        <VoidSheet visible={!!ask} onClose={() => finish(null)} title={ask?.optional ? 'Done. Proof?' : 'Prove it'} caption={ask?.title} maxShare={0.85}>
            <View style={styles.body}>
                <View style={[styles.frame, { height: height * FRAME_SHARE, backgroundColor: Colors.common.black }]}>
                    {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} accessibilityLabel="Your photo" />
                        : live ? (
                            // The whole picture is a shutter too: tap anywhere.
                            <Pressable style={StyleSheet.absoluteFill} onPress={() => void shoot()} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                                <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} />
                            </Pressable>
                        ) : null}

                    {ask?.optional && !photo ? (
                        <Pressable onPress={() => finish(null)} accessibilityRole="button" accessibilityLabel="Skip the photo" hitSlop={Spacing.sm}
                            style={[styles.corner, { backgroundColor: `${Colors.common.black}80` }]}>
                            <RNText style={[t.type.heading, { color: white }]}>Skip</RNText>
                        </Pressable>
                    ) : null}

                    <View style={styles.controls} pointerEvents="box-none">
                        <LinearGradient pointerEvents="none" colors={[`${Colors.common.black}00`, `${Colors.common.black}99`]} style={StyleSheet.absoluteFill} />
                        {photo ? (
                            <View style={styles.row}>
                                <View style={styles.grow}><AppButton label="Retake" icon="refresh" onPress={() => setPhoto(null)} /></View>
                                <View style={styles.grow}><AppButton label="Use photo" icon="checkmark" variant="primary" onPress={() => { successFeedback(); finish(photo); }} /></View>
                            </View>
                        ) : (
                            <View style={styles.shutterRow}>
                                <View style={styles.side} />
                                <ShutterButton busy={taking} onPress={() => void shoot()} />
                                <View style={styles.side}>
                                    <IconButton icon="camera-reverse-outline" label={facing === 'back' ? 'Use front camera' : 'Use back camera'} color={white}
                                        disabled={!live} onPress={() => { lightFeedback(); setFacing(side => (side === 'back' ? 'front' : 'back')); }} />
                                </View>
                            </View>
                        )}
                    </View>
                </View>
                <Text variant="caption" tone="muted" align="center" numberOfLines={2}>{ask?.optional
                    ? 'Your friends see it on your day.'
                    : 'It counts for a challenge or a bet. Taken now, never from your library.'}</Text>
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
    frame: { borderRadius: Radius.card, overflow: 'hidden' },
    corner: { position: 'absolute', top: Spacing.md, right: Spacing.md, minHeight: Spacing.section + Spacing.xs, paddingHorizontal: Spacing.lg, borderRadius: Radius.pill, justifyContent: 'center' },
    controls: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: Spacing.section, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
    shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    side: { flex: 1, alignItems: 'flex-end' },
    row: { flexDirection: 'row', gap: Spacing.sm },
    grow: { flex: 1 },
});
