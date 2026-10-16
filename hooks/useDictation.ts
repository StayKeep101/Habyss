import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

type Speech = typeof import('expo-speech-recognition')['ExpoSpeechRecognitionModule'];

function speech(): Speech | null {
    try {
        return (require('expo-speech-recognition') as typeof import('expo-speech-recognition')).ExpoSpeechRecognitionModule ?? null;
    } catch {
        return null;
    }
}

/**
 * Speaking into a text field: tap the mic, talk, and the words appear in the
 * field as they are heard; tap again (or pause) to stop. The same speech
 * module as holding +, one session at a time. Absent on a build without it.
 */
export function useDictation(onText: (heard: string) => void, onDone?: (heard: string) => void) {
    const module = useRef(speech()).current;
    const [listening, setListening] = useState(false);
    const mine = useRef(false);
    const latestOnText = useRef(onText);
    latestOnText.current = onText;
    const latestOnDone = useRef(onDone);
    latestOnDone.current = onDone;
    const heardSoFar = useRef('');

    useEffect(() => {
        if (!module) return;
        const listeners = [
            module.addListener('result', event => {
                if (!mine.current) return;
                heardSoFar.current = event.results[0]?.transcript ?? '';
                latestOnText.current(heardSoFar.current);
            }),
            // Finished: the caller gets the whole of it, to tidy (lib/voiceClean.ts).
            module.addListener('end', () => {
                if (!mine.current) return;
                mine.current = false;
                setListening(false);
                if (heardSoFar.current) latestOnDone.current?.(heardSoFar.current);
            }),
            module.addListener('error', () => { if (mine.current) { mine.current = false; setListening(false); } }),
        ];
        return () => {
            listeners.forEach(listener => listener.remove());
            if (mine.current) module.stop();
        };
    }, [module]);

    const start = useCallback(async () => {
        if (!module) return;
        const permission = await module.requestPermissionsAsync().catch(() => null);
        if (!permission?.granted) {
            Alert.alert('Microphone is off', 'Allow the microphone and speech recognition for Habyss in Settings to talk instead of typing.');
            return;
        }
        mine.current = true;
        heardSoFar.current = '';
        setListening(true);
        module.start({ lang: 'en-US', interimResults: true, continuous: false, addsPunctuation: true });
    }, [module]);

    const stop = useCallback(() => { if (module && mine.current) module.stop(); }, [module]);

    return { available: !!module, listening, start, stop, toggle: listening ? stop : start };
}
