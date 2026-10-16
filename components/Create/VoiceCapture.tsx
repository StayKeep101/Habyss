import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { readVoice } from '@/lib/voiceIntent';
import { normaliseLevel, voiceLevel } from '@/lib/voiceLevel';

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

/**
 * Listens while the create button is held, and acts when it is let go.
 *
 * Hold: "create a habit of reading every night", "add a task to call mum
 * tomorrow", "new goal: save $5000". Release: the right sheet opens with the
 * words already in it, where the usual parser fills in the rest.
 *
 * Draws nothing itself. The button morphs into the listening pill
 * (components/TabBar/VoiceOrb.tsx) from the `voice_state` it announces.
 */
export function VoiceCapture() {
    const { mediumFeedback, lightFeedback } = useHaptics();
    const latest = useRef('');
    const active = useRef(false);
    /** Let go before the microphone was even ready: stop as soon as it is. */
    const releasedEarly = useRef(false);

    useEffect(() => {
        const module = speech();
        if (!module) return;

        const finish = () => {
            if (!active.current) return;
            active.current = false;
            voiceLevel.value = 0;
            emit('voice_state', { listening: false, heard: '' });
            const intent = readVoice(latest.current);
            if (!intent) return;
            lightFeedback();
            // A beat, so the pill has folded back into the button first.
            setTimeout(() => {
                if (intent.kind === 'habit') emit('show_quick_add', { prefillName: intent.text });
                else if (intent.kind === 'goal') emit('show_goal_quick_add', { prefill: intent.text });
                else emit('show_task_form', { prefill: intent.text });
            }, 220);
        };

        const listeners = [
            module.addListener('result', event => {
                latest.current = event.results[0]?.transcript ?? '';
                emit('voice_state', { listening: true, heard: latest.current });
            }),
            module.addListener('volumechange', event => { voiceLevel.value = normaliseLevel(event.value); }),
            module.addListener('end', finish),
            module.addListener('error', event => {
                // Letting go before anything was said is not an error worth a word.
                if (event.error !== 'no-speech' && event.error !== 'aborted') console.warn('[Voice]', event.error, event.message);
                finish();
            }),
        ];

        const start = on('voice_start', async () => {
            releasedEarly.current = false;
            latest.current = '';
            emit('voice_state', { listening: true, heard: '' });
            const permission = await module.requestPermissionsAsync().catch(() => null);
            if (!permission?.granted) {
                emit('voice_state', { listening: false, heard: '' });
                Alert.alert('Microphone is off', 'Allow the microphone and speech recognition for Habyss in Settings to create by voice.');
                return;
            }
            // The permission sheet takes the finger away; nothing to listen to.
            if (releasedEarly.current) { emit('voice_state', { listening: false, heard: '' }); return; }
            mediumFeedback();
            active.current = true;
            module.start({
                lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: false,
                volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
            });
        });
        const stop = on('voice_stop', () => {
            if (!active.current) { releasedEarly.current = true; emit('voice_state', { listening: false, heard: '' }); return; }
            // Stop asks for the final words; 'end' then opens the sheet.
            module.stop();
        });

        return () => {
            listeners.forEach(listener => listener.remove());
            start.remove();
            stop.remove();
        };
    }, [lightFeedback, mediumFeedback]);

    return null;
}
