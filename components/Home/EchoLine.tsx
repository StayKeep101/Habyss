import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';
import { ms } from '@/theme/scale';
import { tint } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';

/** One letter appears every step: quick enough to read along, slow enough to feel written. */
const STEP = DURATION.tap / 4;
/** A breath before the first word. */
const PRE_ROLL = DURATION.base;
/** How many letters just ahead of the writing are already faintly there. */
const FRONT = 6;

/**
 * Echo's line on Home, written out smoothly.
 *
 * The letters appear one after another from a soft edge: the few just ahead
 * are already faintly there in Echo's colour, the rest not yet. Nothing
 * flickers or changes shape. The real sentence is laid out underneath,
 * invisible, so the line's height is fixed from the start and nothing jumps.
 *
 * The edge takes Echo's mood (lib/taskPressure.ts): the accent when calm,
 * amber when worried, red in demon mode. With Reduce Motion the line simply
 * appears. VoiceOver always reads the real sentence.
 *
 * Its own component so the writing re-renders only this line, not Home.
 */
export function EchoLine({ text, style, onPress, onDone, mood = 0, align = 'left' }: {
    text: string; style?: object; onPress?: () => void;
    /** Left in a column of text; centred under the hourglass. */
    align?: 'left' | 'center';
    /** How worried Echo is about your tasks, 0 calm to 4 demon: the writing edge's colour. */
    mood?: number;
    /** Called once the line has fully appeared (e.g. to ask a question after it). */
    onDone?: () => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const reduced = useReducedMotion();
    const [shown, setShown] = useState(0);
    const doneRef = useRef(onDone);
    useEffect(() => { doneRef.current = onDone; }, [onDone]);

    useEffect(() => {
        if (reduced) { setShown(text.length); doneRef.current?.(); return; }
        setShown(0);
        let index = 0;
        let timer: ReturnType<typeof setInterval> | undefined;
        const start = setTimeout(() => {
            timer = setInterval(() => {
                index += 1;
                setShown(index);
                if (index >= text.length) { if (timer) clearInterval(timer); doneRef.current?.(); }
            }, STEP);
        }, PRE_ROLL);
        return () => { clearTimeout(start); if (timer) clearInterval(timer); };
    }, [text, reduced]);

    const glow = mood >= 4 ? colors.error : mood >= 2 ? colors.warning : primary;
    const rest = useMemo(() => ({ near: text.slice(shown, shown + FRONT), far: text.slice(shown + FRONT) }), [text, shown]);
    const done = shown >= text.length;

    return (
        <Pressable style={style} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'}
            accessibilityLabel={text} accessibilityHint={onPress ? 'Opens Echo' : undefined}>
            {/* Clipped to the real sentence's box: the runes never spill past it. */}
            <View style={styles.box}>
                {/* The real sentence: it sets the line's size from the first frame, and is what stays. */}
                <Text style={[styles.line, { color: colors.text, opacity: done ? 1 : 0, textAlign: align }]}>{text}</Text>
                {done ? null : (
                    <Text style={[styles.line, styles.over, { color: colors.text, textAlign: align }]} importantForAccessibility="no" accessibilityElementsHidden>
                        {text.slice(0, shown)}
                        <Text style={{ color: tint(glow, 'border') }}>{rest.near}</Text>
                        <Text style={styles.unwritten}>{rest.far}</Text>
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
    // Not written yet: in place (so the words wrap where they will), unseen.
    unwritten: { opacity: 0 },
});
