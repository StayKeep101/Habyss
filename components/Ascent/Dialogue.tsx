import React, { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { DURATION, EASE } from '@/theme/motion';
import { Typography } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';

const PER_CHAR = 26;
const PAUSE_LONG = 280;
const PAUSE_SHORT = 120;

export interface DialogueHandle {
    /** Shows the whole line at once; true if it was still typing (so the tap is used up). */
    finish: () => boolean;
}

/**
 * Echo's line, typed out at a speaking pace: a beat after a full stop, a
 * breath after a comma. A tap shows it all at once (never wait for text);
 * the screen's next tap moves on. VoiceOver hears the whole line, at once.
 * With Reduce Motion it simply appears.
 */
export function Dialogue({ text, onTyped, handle }: { text: string; onTyped?: () => void; handle: React.Ref<DialogueHandle> }) {
    const t = useTokens();
    const reduced = useReducedMotion();
    const [shown, setShown] = useState(reduced ? text.length : 0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typed = useRef(onTyped);
    useLayoutEffect(() => { typed.current = onTyped; });

    useEffect(() => {
        AccessibilityInfo.announceForAccessibility(text);
        // A new line is a new Dialogue (keyed by its text), so it starts from nothing.
        if (reduced) { typed.current?.(); return; }
        let index = 0;
        const tick = () => {
            index++;
            setShown(index);
            if (index >= text.length) { timer.current = null; typed.current?.(); return; }
            const char = text[index - 1];
            const wait = /[.!?…]/.test(char) ? PAUSE_LONG : /[,—:]/.test(char) ? PAUSE_SHORT : PER_CHAR;
            timer.current = setTimeout(tick, wait);
        };
        timer.current = setTimeout(tick, 220);
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [text, reduced]);

    useImperativeHandle(handle, () => ({
        finish: () => {
            if (shown >= text.length) return false;
            if (timer.current) clearTimeout(timer.current);
            timer.current = null;
            setShown(text.length);
            typed.current?.();
            return true;
        },
    }), [shown, text]);

    return (
        <Animated.View key={text} entering={FadeIn.duration(DURATION.quick).easing(EASE.enter)} exiting={FadeOut.duration(DURATION.tap)}
            accessible accessibilityLabel={text} accessibilityLiveRegion="polite">
            <Text style={[styles.line, { color: t.color.textPrimary }]}>
                {text.slice(0, shown)}
                {/* The rest is laid out but unseen, so the line never reflows as it types. */}
                <Text style={styles.unseen}>{text.slice(shown)}</Text>
            </Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    // Echo's line is what the page is about: it is set as a page title.
    line: Typography.screenTitle,
    unseen: { opacity: 0 },
});
