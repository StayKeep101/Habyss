import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';

const timeOf = (at: string) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** One message. Yours are a solid accent fill on the right; theirs are matte on the left. */
export function MessageBubble({ body, at, mine, onLongPress }: {
    body: string; at: string; mine: boolean; onLongPress?: () => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();

    const text = (
        <View style={styles.inner}>
            <Text style={[styles.body, { color: mine ? colors.background : colors.textPrimary }]}>{body}</Text>
            <Text style={[styles.time, { color: mine ? colors.background : colors.textTertiary }]}>{timeOf(at)}</Text>
        </View>
    );

    return (
        <Pressable onLongPress={onLongPress} delayLongPress={350} style={[styles.row, mine ? styles.mine : styles.theirs]}
            accessibilityRole="text" accessibilityLabel={`${mine ? 'You' : 'Them'}: ${body}, ${timeOf(at)}`}>
            {mine ? (
                <View style={[styles.bubble, { backgroundColor: primary }]}>{text}</View>
            ) : (
                <MatteSurface radius={Radius.control} level="control" style={styles.bubble}>{text}</MatteSurface>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: { maxWidth: '80%', marginVertical: 2 },
    mine: { alignSelf: 'flex-end' },
    theirs: { alignSelf: 'flex-start' },
    bubble: { borderRadius: Radius.control },
    inner: { paddingHorizontal: Spacing.md + Spacing.xs / 2, paddingVertical: Spacing.sm + 1, gap: 2 },
    body: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21 },
    time: { fontFamily: FontFamily.regular, fontSize: 10, opacity: 0.7, alignSelf: 'flex-end' },
});
