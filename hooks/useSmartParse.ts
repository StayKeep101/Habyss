import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { currentEngine, isOnDeviceAIReady } from '@/lib/onDeviceAI';

/**
 * Runs an on-device model reading of `text` once typing pauses.
 *
 * `result` is null until the model answers for the text currently typed, so
 * callers show their instant rule-based reading until then and never show an
 * answer for words the user has since changed. `thinking` is true while the
 * model is working; `available` is false when no model is ready on this phone.
 */
export function useSmartParse<T>(
    text: string,
    parse: (text: string) => Promise<T | null>,
    delay = 650,
    /**
     * Whether to bother at all.
     *
     * Opening an existing habit or goal to edit it fills the field with its own
     * saved title, and both sheets then throw the model's reading away — but
     * the model still ran. Waking an on-device LLM to re-read a sentence whose
     * answer is going to be discarded is the most expensive no-op in the app.
     */
    enabled = true,
) {
    const [result, setResult] = useState<{ text: string; value: T } | null>(null);
    const [thinking, setThinking] = useState<string | null>(null);
    const [failedText, setFailedText] = useState<string | null>(null);
    const pending = useRef(false);
    const mounted = useRef(true);
    const revision = useRef(0);
    const latest = useRef(text);
    useLayoutEffect(() => {
        if (latest.current !== text) revision.current += 1;
        latest.current = text;
    }, [text]);
    const automatic = isOnDeviceAIReady() && enabled;
    const available = currentEngine('parse') !== null && enabled;
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    // A downloaded model on an older phone runs only on an explicit tap.
    const request = async () => {
        const trimmed = text.trim();
        if (!available || trimmed.length < 3 || pending.current) return;
        const requestedRevision = revision.current;
        pending.current = true;
        setThinking(trimmed);
        setFailedText(null);
        const value = await parse(trimmed).catch(() => null);
        pending.current = false;
        if (!mounted.current) return;
        setThinking(null);
        if (requestedRevision !== revision.current) return;
        setFailedText(value ? null : trimmed);
        if (value) setResult({ text: trimmed, value });
    };

    useEffect(() => {
        const trimmed = text.trim();
        if (!automatic || trimmed.length < 3) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            setThinking(trimmed);
            const value = await parse(trimmed).catch(() => null);
            if (cancelled || latest.current.trim() !== trimmed) return;
            setThinking(null);
            if (value) setResult({ text: trimmed, value });
        }, delay);
        return () => { cancelled = true; clearTimeout(timer); };
        // `parse` is a module function; re-running on its identity would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, automatic, delay]);

    const fresh = available && result && result.text === text.trim() ? result.value : null;
    return { result: fresh, thinking: available && thinking !== null && (!automatic || thinking === text.trim()) && !fresh, available,
        request: available && !automatic && text.trim().length >= 3 ? request : undefined,
        failed: available && failedText === text.trim() };
}
