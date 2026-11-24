import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { AppButton, CountUp, Text } from '@/components/ui';
import { PopupCard } from '@/components/ui/PopupCard';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { earnedSince, markShardsSeen, shardsSeenAt, type AwaySummary } from '@/lib/awayShards';
import type { ShardMove } from '@/lib/shards';
import { DURATION } from '@/theme/motion';
import { Spacing } from '@/theme/designSystem';

/** How long after coming back before it adds up: Health, the widget's ticks and the night's sleep land first. */
const SETTLE_MS = DURATION.reward * 4;
/** Lines shown; the rest are summed in one. */
const LINES = 5;

/**
 * Back in the app: what you earned while you were not in it, each thing on
 * its own line (a full night's sleep +20, Run +5…) and the total counting up.
 * Most of a day can earn with the app closed (Health, places, the Lock Screen
 * card), so this is where it is seen. Once per return; nothing when nothing
 * was earned. Mounted on Home.
 */
export function AwayShards({ moves, ready }: { moves: ShardMove[]; ready: boolean }) {
    const t = useTokens();
    const { successFeedback } = useHaptics();
    const [summary, setSummary] = useState<AwaySummary | null>(null);
    const movesRef = useRef(moves);
    useEffect(() => { movesRef.current = moves; }, [moves]);

    useEffect(() => {
        if (!ready) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const back = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                void shardsSeenAt().then(since => {
                    const now = Date.now();
                    // First time: from now on.
                    const found = since ? earnedSince(movesRef.current, since, now) : null;
                    void markShardsSeen(now);
                    if (found) { successFeedback(); setSummary(found); }
                });
            }, SETTLE_MS);
        };
        back();
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') back();
            // Leaving: anything from here on happened while away.
            else if (state === 'background') { if (timer) clearTimeout(timer); void markShardsSeen(); }
        });
        return () => { sub.remove(); if (timer) clearTimeout(timer); };
    }, [ready, successFeedback]);

    const shown = summary?.lines.slice(0, LINES) ?? [];
    const rest = summary ? summary.lines.slice(LINES).reduce((sum, line) => sum + line.amount, 0) : 0;
    const close = () => setSummary(null);
    return (
        <PopupCard visible={!!summary} onClose={close} icon="diamond" iconColor={t.color.cobalt} badge={<ShardIcon size={Spacing.section * 2} />}
            title="While you were away">
            <View style={styles.total} accessible accessibilityLabel={`${summary?.total ?? 0} Shards earned`}>
                <ShardIcon size={Spacing.xxl} />
                <CountUp value={summary?.total ?? 0} replay={summary} style={[t.type.display, { color: t.color.textPrimary }]} />
            </View>
            <View style={styles.lines}>
                {shown.map(line => <Line key={line.title} title={line.title} amount={line.amount} />)}
                {rest ? <Line title="And more" amount={rest} /> : null}
            </View>
            <AppButton label="Nice" variant="primary" compact onPress={close} />
        </PopupCard>
    );
}

function Line({ title, amount }: { title: string; amount: number }) {
    return (
        <View style={styles.line} accessible accessibilityLabel={`${title}, ${amount > 0 ? '+' : ''}${amount} Shards`}>
            <Text variant="body" grow numberOfLines={1}>{title}</Text>
            <Text variant="heading" tone={amount > 0 ? 'primary' : 'danger'} numeric>{`${amount > 0 ? '+' : ''}${amount}`}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    lines: { gap: Spacing.sm, marginBottom: Spacing.md },
    line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
