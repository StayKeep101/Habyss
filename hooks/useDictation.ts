import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { speechOptions, Transcript } from '@/lib/speechOptions';

/** Quiet this long after speaking ends it; a pause to think is shorter. */
const QUIET_MS = 2500;

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
 * field as they are heard; tap again, or stay quiet a moment, to stop. A
 * pause to think does not cut you off, and nothing said before a pause is
 * lost (lib/speechOptions.ts). The same speech module as holding +, one
 * session at a time. Absent on a build without it.
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
    const transcript = useRef(new Transcript()).current;
    const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hush = () => { if (quiet.current) clearTimeout(quiet.current); quiet.current = null; };

    useEffect(() => {
        if (!module) return;
        const listeners = [
            module.addListener('result', event => {
                if (!mine.current) return;
                heardSoFar.current = transcript.push(event);
                latestOnText.current(heardSoFar.current);
                // Still talking: the quiet timer starts again.
                hush();
                quiet.current = setTimeout(() => { if (mine.current) module.stop(); }, QUIET_MS);
            }),
            // Finished: the caller gets the whole of it, to tidy (lib/voiceClean.ts).
            module.addListener('end', () => {
                if (!mine.current) return;
                mine.current = false;
                hush();
                setListening(false);
                if (heardSoFar.current) latestOnDone.current?.(heardSoFar.current);
            }),
            module.addListener('error', () => { if (mine.current) { mine.current = false; hush(); setListening(false); } }),
        ];
        return () => {
            listeners.forEach(listener => listener.remove());
            hush();
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
        transcript.reset();
        setListening(true);
        module.start(await speechOptions({ punctuation: true }));
        // Tapped and nothing said: it stops by itself rather than listening forever.
        hush();
        quiet.current = setTimeout(() => { if (mine.current) module.stop(); }, 8000);
    }, [module, transcript]);

    const stop = useCallback(() => { if (module && mine.current) module.stop(); }, [module]);
    /**
     * You changed the text yourself while it was listening (deleted it, say):
     * your edit wins. It stops, and nothing it heard is written back.
     */
    const cancel = useCallback(() => {
        if (!module || !mine.current) return;
        mine.current = false;
        hush();
        heardSoFar.current = '';
        setListening(false);
        module.abort?.();
    }, [module]);

    return { available: !!module, listening, start, stop, cancel, toggle: listening ? stop : start };
}
