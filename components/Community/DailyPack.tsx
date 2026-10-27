import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useAccentGradient } from '@/context/AccentContext';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import type { FeedPost } from '@/lib/feedService';

/**
 * Today's pack, waiting at the top of Community: a little fanned stack of
 * cards that breathes while it is still sealed, who is in it, and how many
 * you have turned over. Tomorrow it is a new pack.
 */
export function DailyPack({ posts, opened, onOpen }: { posts: FeedPost[]; opened: number; onOpen: () => void }) {
    const t = useTokens();
    const { colors } = useAccentGradient();
    const sealed = opened === 0 && posts.length > 0;
    const glow = useSharedValue(0);
    useEffect(() => {
        if (!sealed) { glow.value = 0; return; }
        glow.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }), -1, true);
    }, [sealed, glow]);
    const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * glow.value }, { rotate: `${-4 + 2 * glow.value}deg` }] }));

    const names = posts.slice(0, 2).map(post => post.name.split(' ')[0]);
    const who = posts.length > 2 ? `${names.join(', ')} and ${posts.length - 2} more` : names.join(' and ');
    const line = !posts.length ? "Your friends' cards arrive at the times they choose"
        : opened >= posts.length ? `All ${posts.length} seen · a new pack tomorrow`
        : opened > 0 ? `${opened} of ${posts.length} seen · ${who}`
        : `${posts.length === 1 ? '1 card' : `${posts.length} cards`} · ${who}`;
    return (
        <Pressable onPress={onOpen} disabled={!posts.length} accessibilityRole="button"
            accessibilityLabel={`Today's pack. ${line}`} accessibilityHint={posts.length ? 'Opens the cards one by one' : undefined}>
            <MatteSurface radius={Radius.card} style={styles.card}>
                <View style={styles.stack} importantForAccessibility="no-hide-descendants">
                    <View style={[styles.mini, styles.under, { opacity: posts.length ? 0.5 : 0.25 }]}>
                        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    </View>
                    <Animated.View style={[styles.mini, { opacity: posts.length ? 1 : 0.35 }, lift]}>
                        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} style={StyleSheet.absoluteFill} />
                        <View style={styles.miniTear} />
                    </Animated.View>
                </View>
                <View style={styles.text}>
                    <Text style={[styles.title, { color: t.color.textPrimary }]}>Today's pack</Text>
                    <Text numberOfLines={1} style={[styles.line, { color: t.color.textMuted }]}>{line}</Text>
                </View>
                {posts.length ? <AppIcon name="chevron-forward" size={18} color={t.color.textMuted} /> : null}
            </MatteSurface>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
    stack: { width: 46, height: 60, alignItems: 'center', justifyContent: 'center' },
    mini: { position: 'absolute', width: 40, height: 56, borderRadius: 8, overflow: 'hidden' },
    under: { transform: [{ rotate: '8deg' }, { translateX: 5 }] },
    miniTear: { position: 'absolute', top: 10, left: 4, right: 4, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.6)' },
    text: { flex: 1, gap: 2 },
    title: { fontSize: 17, fontFamily: FontFamily.bold },
    line: { fontSize: 13, fontFamily: FontFamily.medium },
});
