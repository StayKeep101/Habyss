import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';

/**
 * Echo's line on Home, typed out a letter at a time.
 *
 * Its own component so the typing re-renders only this line. It lived in the
 * Home screen's state, so every letter (every 30 ms) re-rendered all of Home.
 */

export function EchoLine({ text, style, onPress, onDone, mood = 0 }: {
    text: string; style?: object; onPress?: () => void;
    /**
     * How worried Echo is about your tasks, 0 calm to 4 demon (lib/taskPressure.ts).
     * Its name warms and reddens with it; the words never announce a feeling
     * (a person shows worry in what they say, they do not tag it).
     */
    mood?: number;
    /** Called once the line has finished typing out (e.g. to ask a question after it). */
    onDone?: () => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const [shown, setShown] = useState('');
    const doneRef = useRef(onDone);
    useEffect(() => { doneRef.current = onDone; }, [onDone]);

    useEffect(() => {
        setShown('');
        let index = 0;
        const timer = setInterval(() => {
            index += 1;
            setShown(text.slice(0, index));
            if (index >= text.length) { clearInterval(timer); doneRef.current?.(); }
        }, 30);
        return () => clearInterval(timer);
    }, [text]);

    return (
        <Pressable style={style} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityHint={onPress ? 'Opens Echo' : undefined}>
            <Text style={[styles.label, { color: mood >= 4 ? colors.error : mood >= 2 ? colors.warning : colors.textTertiary }]}>
                Echo
            </Text>
            <Text style={[styles.line, { color: colors.text }]}>
                {shown}
                {shown.length < text.length ? <Text style={{ color: primary }}>|</Text> : null}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    label: { fontSize: ms(12), fontFamily: FontFamily.medium, marginBottom: 4 },
    line: { fontSize: ms(15), fontFamily: FontFamily.semibold, textAlign: 'left', lineHeight: ms(22) },
});
