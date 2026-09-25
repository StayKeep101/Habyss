import { useEffect, useRef, useState } from 'react';
import { isOnDeviceAIReady } from '@/lib/onDeviceAI';

/**
 * Runs an on-device model reading of `text` once typing pauses.
 *
 * `result` is null until the model answers for the text currently typed, so
 * callers show their instant rule-based reading until then and never show an
 * answer for words the user has since changed. `thinking` is true while the
 * model is working; `available` is false when no model is ready on this phone.
 */
export function useSmartParse<T>(text: string, parse: (text: string) => Promise<T | null>, delay = 650) {
    const [result, setResult] = useState<{ text: string; value: T } | null>(null);
    const [thinking, setThinking] = useState(false);
    const latest = useRef(text);
    latest.current = text;
    const available = isOnDeviceAIReady();

    useEffect(() => {
        const trimmed = text.trim();
        if (!available || trimmed.length < 3) { setThinking(false); return; }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setThinking(true);
            const value = await parse(trimmed).catch(() => null);
            if (cancelled || latest.current.trim() !== trimmed) return;
            setThinking(false);
            if (value) setResult({ text: trimmed, value });
        }, delay);
        return () => { cancelled = true; clearTimeout(timer); };
        // `parse` is a module function; re-running on its identity would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, available, delay]);

    const fresh = result && result.text === text.trim() ? result.value : null;
    return { result: fresh, thinking: thinking && !fresh, available };
}
