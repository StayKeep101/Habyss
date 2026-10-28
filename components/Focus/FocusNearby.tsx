import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { Control, FontFamily, Spacing } from '@/theme/designSystem';

/**
 * A friend who is focusing at the same moment as you, by chance: their face,
 * "Maya is focusing too · Study bio", and Together. Tapping it keeps your
 * own thing and your own clock; your faces just show on each other's focus
 * page from then on. The × lets it go for this session.
 */
export function FocusNearby({ friend, accent, onTogether, onDismiss }: {
    friend: { userId: string; name: string; avatarUrl?: string; focusLabel?: string | null };
    accent: string;
    onTogether: () => void;
    onDismiss: () => void;
}) {
    const first = friend.name.split(' ')[0] || friend.name;
    const what = friend.focusLabel?.trim();
    return (
        <Animated.View entering={FadeInDown.duration(320).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)} style={styles.card}>
            <Avatar name={friend.name} uri={friend.avatarUrl} size={36} ring={accent} />
            <View style={styles.text} accessible accessibilityLabel={`${first} is focusing too${what ? `, on ${what}` : ''}`}>
                <Text numberOfLines={1} style={styles.title}>{first} is focusing too</Text>
                {what ? <Text numberOfLines={1} style={styles.sub}>{what}</Text> : null}
            </View>
            <Pressable onPress={onTogether} style={styles.together} accessibilityRole="button" accessibilityLabel={`Focus together with ${first}`} hitSlop={6}>
                <Text style={styles.togetherText}>Together</Text>
            </Pressable>
            <Pressable onPress={onDismiss} style={styles.close} accessibilityRole="button" accessibilityLabel="Not now" hitSlop={6}>
                <AppIcon name="close" size={16} color="rgba(255,255,255,0.75)" />
            </Pressable>
        </Animated.View>
    );
}

// Over the focus page's black, like its other controls.
const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, alignSelf: 'stretch', maxWidth: 420, paddingLeft: Spacing.md, paddingRight: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
    text: { flex: 1, gap: 1 },
    title: { fontFamily: FontFamily.semibold, fontSize: 15, color: '#FFFFFF' },
    sub: { fontFamily: FontFamily.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
    together: { minHeight: 36, paddingHorizontal: Spacing.md, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    togetherText: { fontFamily: FontFamily.semibold, fontSize: 14, color: '#000000' },
    close: { width: Control.hitTarget, height: Control.hitTarget, alignItems: 'center', justifyContent: 'center' },
});
