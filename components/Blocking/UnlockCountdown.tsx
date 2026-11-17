import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimatedFill, Text } from '@/components/ui';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { useTokens } from '@/hooks/useTokens';
import { clockLabel } from '@/lib/dayFlow';
import { Radius, Spacing } from '@/theme/designSystem';

/** "47:09": minutes and seconds left (hours too, past one). Pure. */
export function countdown(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * Your apps are open (an hour bought with Shards): the time left, ticking each
 * second, a bar that drains with it, and when they lock again. `onEnd` runs
 * once at zero, so the page can show the button again.
 */
export function UnlockCountdown({ until, length, onEnd }: { until: number; length: number; onEnd: () => void }) {
    const t = useTokens();
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    const left = until - now;
    useEffect(() => { if (left <= 0) onEnd(); }, [left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
    const at = new Date(until);
    const minutesLeft = Math.ceil(Math.max(0, left) / 60_000);
    return (
        <MatteSurface radius={Radius.card} style={styles.card}>
            <Text variant="caption" tone="muted" align="center">YOUR APPS ARE OPEN</Text>
            <Text variant="display" align="center" numeric accessibilityRole="timer"
                accessibilityLabel={`${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'} left`}>{countdown(left)}</Text>
            <View style={[styles.track, { backgroundColor: t.color.border }]}>
                <AnimatedFill progress={Math.max(0, left) / length} style={[styles.fill, { backgroundColor: t.color.accent }]} />
            </View>
            <Text variant="bodySmall" tone="muted" align="center">They lock again at {clockLabel(at.getHours() * 60 + at.getMinutes())}</Text>
        </MatteSurface>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.xl, gap: Spacing.sm },
    track: { height: Spacing.sm, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.xs },
    fill: { height: '100%', borderRadius: Radius.pill },
});
