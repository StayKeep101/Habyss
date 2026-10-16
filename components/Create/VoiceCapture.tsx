import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { readVoice } from '@/lib/voiceIntent';
import { getVoiceDestination } from '@/lib/voiceDestination';
import { addThought } from '@/lib/brainDump';
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
 * Hold and speak; release, and the words go where Settings says: a thought
 * in the brain dump (the default), or a task, habit or goal sheet opened with
 * the words already in it, where the usual parser fills in the rest.
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
            const spoken = latest.current.trim();
            if (!spoken) return;
            lightFeedback();
            // Where it goes is the person's choice in Settings (Brain dump by
            // default). "Create a task to…" is still tidied off the front.
            const text = readVoice(spoken)?.text ?? spoken;
            void getVoiceDestination().then(destination => {
                // A beat, so the pill has folded back into the button first.
                setTimeout(() => {
                    if (destination === 'thought') {
                        void addThought(spoken).then(() => require('expo-router').router.push('/brain-dump'));
                    } else if (destination === 'habit') emit('show_quick_add', { prefillName: text });
                    else if (destination === 'goal') emit('show_goal_quick_add', { prefill: text });
                    else emit('show_task_form', { prefill: text });
                }, 220);
            });
        };

        const listeners = [
            // Only its own sessions: a text field dictating (useDictation) shares
            // the same speech module and must not open the + button's pill.
            module.addListener('result', event => {
                if (!active.current) return;
                latest.current = event.results[0]?.transcript ?? '';
                emit('voice_state', { listening: true, heard: latest.current });
            }),
            module.addListener('volumechange', event => { if (active.current) voiceLevel.value = normaliseLevel(event.value); }),
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
