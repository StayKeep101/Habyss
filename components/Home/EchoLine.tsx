import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';
import { ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';

/** One letter every step: an even typewriter rhythm, quick enough to read along. */
const STEP = DURATION.tap / 4;
/** A breath before the first letter. */
const PRE_ROLL = DURATION.base;
/** The rhythm of someone typing: a beat after a comma, a longer one after a full stop. */
const pauseAfter = (letter: string) => (/[.!?]/.test(letter) ? STEP * 8 : /[,;:—–]/.test(letter) ? STEP * 4 : STEP);

/**
 * Echo's line on Home, typed out like a typewriter: one letter at a time at
 * an even pace, a beat at commas and full stops. No cursor: just the words.
 *
 * The real sentence is laid out underneath, invisible, so the line's height
 * is fixed from the start and nothing jumps; the letters not typed yet keep
 * their place (unseen), so words never hop to the next line as they appear.
 *
 * `paused` holds it (a refresh still spinning) until it
 * can be read. With Reduce Motion the line simply appears. VoiceOver always
 * reads the real sentence. Its own component so the typing re-renders only
 * this line, not Home.
 */
export function EchoLine({ text, style, onPress, onDone, mood = 0, paused = false }: {
    text: string; style?: object; onPress?: () => void;
    /** How worried Echo is about your tasks, 0 calm to 4 (kept for callers; the words carry it). */
    mood?: number;
    /** Called once the line has fully appeared (e.g. to ask a question after it). */
    onDone?: () => void;
    /** Wait before typing (the pull-to-refresh spinner is still showing). */
    paused?: boolean;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const reduced = useReducedMotion();
    const [shown, setShown] = useState(0);
    const doneRef = useRef(onDone);
    useEffect(() => { doneRef.current = onDone; }, [onDone]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (reduced) {
            timer = setTimeout(() => { setShown(text.length); doneRef.current?.(); }, 0);
            return () => clearTimeout(timer);
        }
        if (paused) return;
        let index = 0;
        const type = () => {
            index += 1;
            setShown(index);
            if (index >= text.length) { doneRef.current?.(); return; }
            timer = setTimeout(type, pauseAfter(text[index - 1]));
        };
        timer = setTimeout(type, PRE_ROLL);
        return () => { if (timer) clearTimeout(timer); };
    }, [text, reduced, paused]);

    void mood;
    const typed = text.slice(0, shown);
    const unwritten = text.slice(shown);
    const done = shown >= text.length;

    return (
        <Pressable style={style} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'}
            accessibilityLabel={text} accessibilityHint={onPress ? 'Opens Echo' : undefined}>
            <View style={styles.box}>
                {/* The real sentence: it sets the line's size from the first frame, and is what stays. */}
                <Text style={[styles.line, { color: colors.text, opacity: done ? 1 : 0 }]}>{text}</Text>
                {done ? null : (
                    <Text style={[styles.line, styles.over, { color: colors.text }]} importantForAccessibility="no" accessibilityElementsHidden>
                        {typed}
                        <Text style={styles.unwritten}>{unwritten}</Text>
                    </Text>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    line: { fontSize: ms(15), fontFamily: FontFamily.semibold, textAlign: 'left', lineHeight: ms(22) },
    over: { position: 'absolute', top: 0, left: 0, right: 0 },
    box: { overflow: 'hidden' },
    // Not typed yet: in place (so the words wrap where they will), unseen.
    unwritten: { opacity: 0 },
});
