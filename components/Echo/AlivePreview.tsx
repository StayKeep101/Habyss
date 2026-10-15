import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { IconTile } from '@/components/ui/IconTile';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

/**
 * Echo Alive, shown rather than explained: a notification slides in with the
 * nudge before a session, then the check-in after it, and repeats — a few
 * seconds of what will actually reach the phone instead of a paragraph.
 */
export function AlivePreview({ lines, accent }: { lines: { title: string; body: string; when: string }[]; accent: string }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [index, setIndex] = useState(0);
    const shown = useSharedValue(0);

    useEffect(() => {
        const ease = { easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
        shown.set(withSequence(withTiming(1, { duration: 380, ...ease }), withDelay(2200, withTiming(0, { duration: 300, ...ease }))));
        const next = setTimeout(() => setIndex(value => (value + 1) % lines.length), 3100);
        return () => clearTimeout(next);
    }, [index, lines.length, shown]);

    const style = useAnimatedStyle(() => ({
        opacity: shown.get(),
        transform: [{ translateY: (1 - shown.get()) * -16 }, { scale: 0.96 + shown.get() * 0.04 }],
    }));
    const line = lines[index] ?? lines[0];

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
