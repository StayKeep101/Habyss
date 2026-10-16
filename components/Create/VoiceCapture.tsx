import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
    Easing, FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { readVoice } from '@/lib/voiceIntent';

type Speech = typeof import('expo-speech-recognition')['ExpoSpeechRecognitionModule'];

/**
 * The native speech module, or null on a build made before it was added —
 * there, holding the button simply does nothing rather than crashing.
 */
function speech(): Speech | null {
    try {
        const module = require('expo-speech-recognition') as typeof import('expo-speech-recognition');
        return module.ExpoSpeechRecognitionModule ?? null;
    } catch {
        return null;
    }
}

export const voiceAvailable = (): boolean => {
    try { return !!speech()?.isRecognitionAvailable(); } catch { return false; }
};

/**
 * Hold the create button and say what you want: "create a habit of reading
 * every night", "add a task to call mum tomorrow", "new goal: save $5000".
 * Letting go opens that sheet with the words already in it, where the usual
 * parser fills in the rest and everything can still be changed.
 */
export function VoiceCapture() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { mediumFeedback, lightFeedback } = useHaptics();
    const [listening, setListening] = useState(false);
    const [heard, setHeard] = useState('');
    const latest = useRef('');
    const active = useRef(false);

    const pulse = useSharedValue(0);
    useEffect(() => {
        pulse.value = listening
            ? withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }), -1, true)
            : withTiming(0, { duration: 200 });
    }, [listening, pulse]);
    const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.25 }], opacity: 0.35 - pulse.value * 0.2 }));

    useEffect(() => {
        const module = speech();
        if (!module) return;

        const finish = () => {
            if (!active.current) return;
            active.current = false;
            setListening(false);
            const intent = readVoice(latest.current);
            setHeard('');
            if (!intent) return;
            lightFeedback();
            if (intent.kind === 'habit') emit('show_quick_add', { prefillName: intent.text });
            else if (intent.kind === 'goal') emit('show_goal_quick_add', { prefill: intent.text });
            else emit('show_task_form', { prefill: intent.text });
        };

        const listeners = [
            module.addListener('result', event => {
                const text = event.results[0]?.transcript ?? '';
                latest.current = text;
                setHeard(text);
            }),
            module.addListener('end', finish),
            module.addListener('error', event => {
                // Letting go before anything was said is not an error worth a word.
                if (event.error !== 'no-speech' && event.error !== 'aborted') console.warn('[Voice]', event.error, event.message);
                finish();
            }),
        ];

        const start = on('voice_start', async () => {
            const permission = await module.requestPermissionsAsync().catch(() => null);
            if (!permission?.granted) {
                Alert.alert('Microphone is off', 'Allow the microphone and speech recognition for Habyss in Settings to create by voice.');
                return;
            }
            mediumFeedback();
            latest.current = '';
            setHeard('');
            active.current = true;
            setListening(true);
            module.start({ lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: false });
        });
        const stop = on('voice_stop', () => {
            if (!active.current) return;
            // Stop asks for the final words; 'end' then opens the sheet.
            module.stop();
        });

        return () => {
            listeners.forEach(listener => listener.remove());
            start.remove();
            stop.remove();
        };
    }, [lightFeedback, mediumFeedback]);

    if (!listening) return null;

    return (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill} pointerEvents="none">
            <BlurView intensity={30} tint="default" style={StyleSheet.absoluteFill} />
            <View style={styles.center}>
                <View style={styles.micWrap}>
                    <Animated.View style={[styles.ring, ring, { backgroundColor: primary }]} />
                    <View style={[styles.mic, { backgroundColor: primary }]}>
                        <AppIcon name="mic" size={30} color={colors.background} />
                    </View>
                </View>
                <Text style={[styles.heard, { color: heard ? colors.textPrimary : colors.textTertiary }]}>
                    {heard || 'Create a habit of…'}
                </Text>
            </View>
        </Animated.View>
    );
}

const MIC = 76;

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.section, gap: Spacing.xxl },
    micWrap: { width: MIC, height: MIC, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', width: MIC * 1.6, height: MIC * 1.6, borderRadius: MIC * 0.8 },
    mic: { width: MIC, height: MIC, borderRadius: MIC / 2, alignItems: 'center', justifyContent: 'center' },
    heard: { fontFamily: FontFamily.semibold, fontSize: 22, lineHeight: 30, textAlign: 'center' },
});
