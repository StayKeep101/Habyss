import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { IconTile } from '@/components/ui/IconTile';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

/**
 * What Echo will send, shown rather than explained: each notification your
 * settings would produce slides in, in turn. `focus` jumps straight to one
 * (the one a setting just changed), so a change can be seen at once.
 */
export function AlivePreview({ lines, accent, focus }: {
    lines: { key?: string; title: string; body: string; when: string }[];
    accent: string;
    /** Show this line now; `n` changes each time, so the same key can be shown again. */
    focus?: { key: string; n: number };
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [index, setIndex] = useState(0);
    const shown = useSharedValue(0);
    const [lastFocus, setLastFocus] = useState(focus?.n);
    if (focus && focus.n !== lastFocus) {
        setLastFocus(focus.n);
        const at = lines.findIndex(line => line.key === focus.key);
        if (at >= 0 && at !== index) setIndex(at);
    }

    useEffect(() => {
        const ease = { easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
        shown.set(withSequence(withTiming(1, { duration: 380, ...ease }), withDelay(2200, withTiming(0, { duration: 300, ...ease }))));
        const next = setTimeout(() => setIndex(value => (value + 1) % lines.length), 3100);
        return () => clearTimeout(next);
    }, [index, lines.length, shown, lastFocus]);

    const style = useAnimatedStyle(() => ({
        opacity: shown.get(),
        transform: [{ translateY: (1 - shown.get()) * -16 }, { scale: 0.96 + shown.get() * 0.04 }],
    }));
    const line = lines[Math.min(index, lines.length - 1)] ?? lines[0];

    return (
        <View style={styles.stage} accessibilityLabel={`Example: ${line.body}`}>
            <Animated.View style={style}>
                <MatteSurface radius={18} level="control" style={styles.banner}>
                    <IconTile icon="sparkles" color={accent} size={30} shape="square" />
                    <View style={{ flex: 1 }}>
                        <View style={styles.top}>
                            <Text style={[styles.title, { color: colors.textPrimary }]}>{line.title}</Text>
                            <Text style={[styles.when, { color: colors.textTertiary }]}>{line.when}</Text>
                        </View>
                        <Text numberOfLines={2} style={[styles.body, { color: colors.textSecondary }]}>{line.body}</Text>
                    </View>
                </MatteSurface>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    stage: { height: 86, justifyContent: 'center' },
    banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    top: { flexDirection: 'row', justifyContent: 'space-between' },
    title: { fontSize: 14, fontFamily: FontFamily.semibold },
    when: { fontSize: 12, fontFamily: FontFamily.regular },
    body: { fontSize: 13, fontFamily: FontFamily.regular, marginTop: 2 },
});
