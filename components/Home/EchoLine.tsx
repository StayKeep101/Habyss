import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
export function EchoLine({ text, style }: { text: string; style?: object }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const [shown, setShown] = useState('');

    useEffect(() => {
        setShown('');
        let index = 0;
        const timer = setInterval(() => {
            index += 1;
            setShown(text.slice(0, index));
            if (index >= text.length) clearInterval(timer);
        }, 30);
        return () => clearInterval(timer);
    }, [text]);

    return (
        <View style={style}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>Echo</Text>
            <Text style={[styles.line, { color: colors.text }]}>
                {shown}
                {shown.length < text.length ? <Text style={{ color: primary }}>|</Text> : null}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    label: { fontSize: ms(12), fontFamily: FontFamily.medium, marginBottom: 4 },
    line: { fontSize: ms(15), fontFamily: FontFamily.semibold, textAlign: 'left', lineHeight: ms(22) },
});
