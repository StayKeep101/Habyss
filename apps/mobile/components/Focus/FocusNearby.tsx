import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { useTokens } from '@/hooks/useTokens';
import { textOn } from '@/theme/tokens';
import { Control, FontFamily, Radius, Spacing } from '@/theme/designSystem';

const FACE = Control.hitTarget - Spacing.sm;

/**
 * A friend who is focusing at the same moment as you, by chance: their face,
 * "Maya is focusing · Study bio", and Together. Tapping it keeps your own
 * thing and your own clock; your faces just show on each other's focus page
 * from then on. The × lets it go for this session.
 *
 * Drawn as the app draws a card (MatteSurface), with Together as the chosen
 * thing is drawn: a solid pill of the accent.
 */
export function FocusNearby({ friend, accent, onTogether, onDismiss }: {
    friend: { userId: string; name: string; avatarUrl?: string; focusLabel?: string | null };
    accent: string;
    onTogether: () => void;
    onDismiss: () => void;
}) {
    const t = useTokens();
    const first = friend.name.split(' ')[0] || friend.name;
    const what = friend.focusLabel?.trim();
    return (
        <Animated.View entering={FadeInDown.duration(320).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)} style={styles.wrap}>
            <MatteSurface radius={Radius.card} style={styles.card}>
                <Avatar name={friend.name} uri={friend.avatarUrl} size={FACE} />
                <View style={styles.text} accessible accessibilityLabel={`${first} is focusing${what ? `, on ${what}` : ''}`}>
                    <Text numberOfLines={1} style={[t.type.heading, { color: t.color.textPrimary }]}>{first} is focusing</Text>
                    {what ? <Text numberOfLines={1} style={[t.type.bodySmall, { color: t.color.textMuted }]}>{what}</Text> : null}
                </View>
                <Pressable onPress={onTogether} hitSlop={Spacing.xs} accessibilityRole="button" accessibilityLabel={`Focus together with ${first}`}>
                    <View style={[styles.together, { backgroundColor: accent }]}>
                        <Text style={[t.type.bodySmall, styles.togetherText, { color: textOn(accent) }]}>Together</Text>
                    </View>
                </Pressable>
                <Pressable onPress={onDismiss} style={styles.close} accessibilityRole="button" accessibilityLabel="Not now">
                    <AppIcon name="close" size={Spacing.lg} color={t.color.textMuted} />
                </Pressable>
            </MatteSurface>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignSelf: 'stretch', maxWidth: 420 },
    card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingLeft: Spacing.md, paddingVertical: Spacing.sm },
    text: { flex: 1, minWidth: 0 },
    together: { minHeight: Control.hitTarget - Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    togetherText: { fontFamily: FontFamily.semibold },
    close: { width: Control.hitTarget, height: Control.hitTarget, alignItems: 'center', justifyContent: 'center' },
});
