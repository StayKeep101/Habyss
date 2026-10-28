import React from 'react';
import { StyleSheet, Text } from 'react-native';
// The gesture handler's Pressable: on a card that is itself a gesture-handler
// touchable (the list rows), a plain Pressable lost the tap to the card, so
// Focus opened the card's edit sheet instead.
import { Pressable } from 'react-native-gesture-handler';
import { MatteSurface } from './MatteSurface';
import { AppIcon } from './AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { textOn } from '@/theme/tokens';
import { FontFamily } from '@/theme/designSystem';
import { s, vs } from '@/theme/scale';

/**
 * "Focus", as a small solid pill in the thing's own colour: on the card of
 * whatever you should be doing right now, and on the timeline's live row.
 * The same pill says "Join" on a friend's focus session (`word`, `icon`,
 * `accessibilityLabel`).
 */
export function FocusPill({ color, onPress, label, compact, word = 'Focus', icon = 'timer', accessibilityLabel }: {
    color: string; onPress: () => void; label: string; compact?: boolean;
    word?: string; icon?: string; accessibilityLabel?: string;
}) {
    const t = useTokens();
    const ink = textOn(color);
    return (
        <Pressable onPress={onPress} hitSlop={t.space.sm} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `Focus on ${label}`}>
            <MatteSurface radius={t.radius.full} level="control" tint={color} style={[styles.pill, compact && styles.compact]}>
                <AppIcon name={icon} filled size={compact ? s(12) : s(14)} color={ink} />
                <Text style={[t.type.caption, styles.text, { color: ink }]}>{word}</Text>
            </MatteSurface>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    pill: { flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(12), paddingVertical: vs(6) },
    compact: { paddingHorizontal: s(9), paddingVertical: vs(4) },
    text: { fontFamily: FontFamily.semibold },
});
