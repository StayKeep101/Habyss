import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Echo, MatteSurface, Text } from '@/components/ui';
import { useAIPersonality } from '@/context/AIPersonalityContext';
import { useHaptics } from '@/hooks/useHaptics';
import { getDayWindow } from '@/lib/echo';
import { bedtimeLine, minutesPastBedtime, nudgeDue } from '@/lib/bedtimeNudge';
import { DURATION } from '@/theme/motion';
import { Radius, Spacing } from '@/theme/designSystem';

/** How long a line stays before it goes by itself. */
const SHOWN_MS = 7000;

/**
 * Past bedtime and still in Habyss: Echo drops in at the top with a line, in
 * your voice, firmer the later it gets (lib/bedtimeNudge.ts). Once as bedtime
 * passes, then every quarter of an hour while the app is open. Tap it away;
 * it goes by itself too. Mounted once over the app.
 */
export function BedtimeNudgeHost() {
    const insets = useSafeAreaInsets();
    const { personalityId } = useAIPersonality();
    const { lightFeedback } = useHaptics();
    const [line, setLine] = useState<string | null>(null);
    const lastAt = useRef<number | null>(null);
    const lastLine = useRef<string | null>(null);

    useEffect(() => {
        let hide: ReturnType<typeof setTimeout> | undefined;
        const check = async () => {
            if (AppState.currentState !== 'active') return;
            const day = await getDayWindow().catch(() => null);
            const now = new Date();
            if (!day || !nudgeDue(now, day, lastAt.current)) return;
            const past = minutesPastBedtime(now, day) ?? 0;
            const said = bedtimeLine(past, personalityId, lastLine.current);
            lastAt.current = now.getTime();
            lastLine.current = said;
            lightFeedback();
            setLine(said);
            clearTimeout(hide);
            hide = setTimeout(() => setLine(null), SHOWN_MS);
        };
        void check();
        const timer = setInterval(() => void check(), 60_000);
        const sub = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
        return () => { clearInterval(timer); clearTimeout(hide); sub.remove(); };
    }, [personalityId, lightFeedback]);

    if (!line) return null;
    return (
        <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + Spacing.sm }]}
            entering={FadeInUp.duration(DURATION.quick * 2).reduceMotion(ReduceMotion.System)}
            exiting={FadeOutUp.duration(DURATION.quick).reduceMotion(ReduceMotion.System)}>
            <Pressable onPress={() => setLine(null)} accessibilityRole="button" accessibilityLabel={`Echo: ${line}`} accessibilityHint="Dismisses it">
                <MatteSurface radius={Radius.card} elevation="floating">
                    <View style={styles.row}>
                        <View style={styles.echo}><Echo size="small" mood="idle" /></View>
                        <Text variant="bodySmall" grow numberOfLines={3}>{line}</Text>
                    </View>
                </MatteSurface>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, zIndex: 50 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    echo: { width: Spacing.section, height: Spacing.section, alignItems: 'center', justifyContent: 'center' },
});
