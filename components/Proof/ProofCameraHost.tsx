import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AppButton, Text, VoidSheet } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { setPhotoAsker } from '@/lib/challengeProof';
import { Radius, Spacing } from '@/theme/designSystem';

/**
 * The proof camera (lib/challengeProof.ts): a tick that counts for a challenge
 * or a bet, and that nothing tracks by itself, opens it. A photo taken now, in
 * Habyss (no gallery), then Use it or Retake. Closing it leaves the tick undone.
 * Every other habit ticked by hand opens it too, skippable: Skip or closing it
 * keeps the tick, without a photo.
 * Mounted once over the app.
 */
export function ProofCameraHost() {
    const { successFeedback, lightFeedback } = useHaptics();
    const [ask, setAsk] = useState<{ title: string; resolve: (uri: string | null) => void; optional?: boolean } | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [taking, setTaking] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const camera = useRef<CameraView>(null);

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

    return (
        <VoidSheet visible={!!ask} onClose={() => finish(null)} title={ask?.optional ? 'Done. Proof?' : 'Prove it'} caption={ask?.title} maxShare={0.85}
            footer={(
                <View style={styles.footer}>
                    {photo ? (
                        <View style={styles.row}>
                            <View style={styles.grow}><AppButton label="Retake" variant="ghost" onPress={() => setPhoto(null)} /></View>
                            <View style={styles.grow}><AppButton label="Use photo" icon="checkmark" variant="primary" onPress={() => { successFeedback(); finish(photo); }} /></View>
                        </View>
                    ) : ask?.optional ? (
                        <View style={styles.row}>
                            <View style={styles.grow}><AppButton label="Skip" variant="ghost" onPress={() => finish(null)} /></View>
                            <View style={styles.grow}><AppButton label="Take photo" icon="camera" variant="primary" loading={taking} disabled={!permission?.granted} onPress={() => void shoot()} /></View>
                        </View>
                    ) : (
                        <AppButton label="Take photo" icon="camera" variant="primary" loading={taking} disabled={!permission?.granted} onPress={() => void shoot()} />
                    )}
                </View>
            )}>
            <View style={styles.body}>
                <View style={styles.frame}>
                    {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} accessibilityLabel="Your photo" />
                        : permission?.granted && ask ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" /> : null}
                </View>
                <Text variant="caption" tone="muted" align="center">{ask?.optional
                    ? 'Ticked. A photo keeps the moment, and your friends see it on your day.'
                    : 'It counts for a challenge or a bet, so a photo shows it’s done. Taken now, never from your library.'}</Text>
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
    frame: { aspectRatio: 3 / 4, borderRadius: Radius.card, overflow: 'hidden' },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
    row: { flexDirection: 'row', gap: Spacing.sm },
    grow: { flex: 1 },
});
