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

/** Elder Futhark: the old runes Tolkien's Dwarvish script grew from. */
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
/** One letter resolves every step: slow enough to watch the inscription give way. */
const STEP = DURATION.tap / 2;
/** The line holds as runes for a moment before the first one gives way. */
const PRE_ROLL = DURATION.reward;
/** How many runes just ahead of the wave burn bright. */
const FRONT = 3;

/** A letter stays a rune; a space or a mark of punctuation stays itself, so words keep their shape. */
const runic = (char: string) => /[\p{L}\p{N}]/u.test(char);

/** The rune standing in for the letter at `index` on this flicker `beat`: the same for a beat, then another. */
export function runeAt(index: number, beat: number): string {
    const hash = Math.abs(((index + 1) * 2654435761 + beat * 40503) | 0);
    return RUNES[hash % RUNES.length];
}

/**
 * Echo's line on Home, revealed like an old inscription.
 *
 * The whole line first shows as faint runes that flicker, then a wave passes
 * along it and each rune settles into its letter, the few just ahead of the
 * wave burning brighter. Spaces and punctuation never change, so the words
 * keep their shape throughout. The real sentence is laid out underneath,
 * invisible, so the line's height is fixed from the start and nothing jumps.
 *
 * The runes take Echo's mood (lib/taskPressure.ts): the accent when calm,
 * amber when worried, red in demon mode. With Reduce Motion the line simply
 * appears. VoiceOver always reads the real sentence.
 *
 * Its own component so the reveal re-renders only this line, not Home.
 */
export function EchoLine({ text, style, onPress, onDone, mood = 0 }: {
    text: string; style?: object; onPress?: () => void;
    /** How worried Echo is about your tasks, 0 calm to 4 demon: the runes' colour. */
    mood?: number;
    /** Called once the line has fully revealed (e.g. to ask a question after it). */
    onDone?: () => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const reduced = useReducedMotion();
    const [shown, setShown] = useState(0);
    const [beat, setBeat] = useState(0);
    const doneRef = useRef(onDone);
    useEffect(() => { doneRef.current = onDone; }, [onDone]);

    useEffect(() => {
        if (reduced) { setShown(text.length); doneRef.current?.(); return; }
        setShown(0);
        setBeat(0);
        let index = 0;
        let tick = 0;
        let timer: ReturnType<typeof setInterval> | undefined;
        const start = setTimeout(() => {
            timer = setInterval(() => {
                tick += 1;
                // Spaces and punctuation are already themselves: the wave passes them at once.
                do { index += 1; } while (index < text.length && !runic(text[index - 1]));
                setShown(index);
                if (tick % 3 === 0) setBeat(value => value + 1);
                if (index >= text.length) { if (timer) clearInterval(timer); doneRef.current?.(); }
            }, STEP);
        }, PRE_ROLL);
        // The runes flicker while they wait for the wave.
        const flicker = setInterval(() => setBeat(value => value + 1), STEP * 3);
        return () => { clearTimeout(start); if (timer) clearInterval(timer); clearInterval(flicker); };
    }, [text, reduced]);

    const glow = mood >= 4 ? colors.error : mood >= 2 ? colors.warning : primary;
    const rest = useMemo(() => {
        const chars = text.slice(shown).split('');
        const near = chars.slice(0, FRONT).map((char, offset) => (runic(char) ? runeAt(shown + offset, beat) : char)).join('');
        const far = chars.slice(FRONT).map((char, offset) => (runic(char) ? runeAt(shown + FRONT + offset, beat) : char)).join('');
        return { near, far };
    }, [text, shown, beat]);
    const done = shown >= text.length;

    return (
        <Pressable style={style} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'}
            accessibilityLabel={text} accessibilityHint={onPress ? 'Opens Echo' : undefined}>
            {/* Clipped to the real sentence's box: the runes never spill past it. */}
            <View style={styles.box}>
                {/* The real sentence: it sets the line's size from the first frame, and is what stays. */}
                <Text style={[styles.line, { color: colors.text, opacity: done ? 1 : 0 }]}>{text}</Text>
                {done ? null : (
                    <Text style={[styles.line, styles.over, { color: colors.text }]} importantForAccessibility="no" accessibilityElementsHidden>
                        {text.slice(0, shown)}
                        <Text style={{ color: glow }}>{rest.near}</Text>
                        <Text style={{ color: tint(glow, 'border') }}>{rest.far}</Text>
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
});
