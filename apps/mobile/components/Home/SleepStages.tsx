import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { Reveal, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { mixHex } from '@/lib/colorContrast';
import { formatSleep } from '@/lib/sleepLog';
import { SLEEP_STAGES, type SleepNight, type SleepStage } from '@/lib/sleepMath';
import { Radius, Spacing } from '@/theme/designSystem';

const STAGE_NAME: Record<SleepStage, string> = { awake: 'Awake', rem: 'REM', core: 'Core', deep: 'Deep' };
const LANE = Spacing.lg;
const LANE_GAP = Spacing.sm;

/** Each stage's colour: deep in cobalt, core the accent, REM the accent lightened, awake in warning (distinct hues, as sleep apps use). */
export function useStageColors(): Record<SleepStage, string> {
    const t = useTokens();
    return {
        awake: t.color.warning,
        rem: mixHex(t.color.accent, t.color.textPrimary, 0.55),
        core: t.color.accent,
        deep: t.color.cobalt,
    };
}

const clock = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * One night's stages, as sleep apps draw them: four lanes (Awake at the top,
 * Deep at the bottom), each stretch of the night a block in its lane, thin
 * lines where it moved between them; when you fell asleep and woke under it.
 * Drawn in from the left. Below, the time in each stage, named (never by
 * colour alone).
 */
export function SleepStages({ night }: { night: SleepNight }) {
    const t = useTokens();
    const colors = useStageColors();
    const [width, setWidth] = useState(0);
    const span = Math.max(1, (night.wake - night.bed) / 60000);
    const height = SLEEP_STAGES.length * LANE + (SLEEP_STAGES.length - 1) * LANE_GAP;
    const laneY = (stage: SleepStage) => SLEEP_STAGES.indexOf(stage) * (LANE + LANE_GAP);
    const x = (minute: number) => (minute / span) * width;

    return (
        <View style={styles.wrap} accessible
            accessibilityLabel={`${clock(night.bed)} to ${clock(night.wake)}. ${SLEEP_STAGES.map(stage => `${STAGE_NAME[stage]} ${formatSleep(night.stages[stage])}`).join(', ')}`}>
            <View style={styles.chart}>
                <View style={styles.lanes}>
                    {SLEEP_STAGES.map(stage => (
                        <View key={stage} style={styles.laneName}><Text variant="caption" tone="muted">{STAGE_NAME[stage]}</Text></View>
                    ))}
                </View>
                <View style={styles.plot} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
                    {width ? (
                        <Reveal replay={night.bed}>
                            <Svg width={width} height={height}>
                                {/* The faint lanes. */}
                                {SLEEP_STAGES.map(stage => (
                                    <Rect key={stage} x={0} y={laneY(stage)} width={width} height={LANE} rx={Radius.small / 2} fill={t.color.surfaceRaised} opacity={0.5} />
                                ))}
                                {/* Where the night moved between stages. */}
                                {night.segments.slice(1).map(([stage, start], index) => {
                                    const before = night.segments[index][0];
                                    const a = laneY(before) + LANE / 2, b = laneY(stage) + LANE / 2;
                                    return <Line key={`l${start}`} x1={x(start)} x2={x(start)} y1={Math.min(a, b)} y2={Math.max(a, b)} stroke={t.color.textSubtle} strokeWidth={1} opacity={0.5} />;
                                })}
                                {night.segments.map(([stage, start, end]) => (
                                    <Rect key={`s${start}`} x={x(start)} y={laneY(stage)} width={Math.max(2, x(end) - x(start))} height={LANE}
                                        rx={Math.min(LANE / 3, Math.max(1, (x(end) - x(start)) / 2))} fill={colors[stage]} />
                                ))}
                            </Svg>
                        </Reveal>
                    ) : <View style={{ height }} />}
                    <View style={styles.axis}>
                        <Text variant="caption" tone="muted">{clock(night.bed)}</Text>
                        <Text variant="caption" tone="muted">{clock(night.wake)}</Text>
                    </View>
                </View>
            </View>
            {/* The time in each stage, deepest first. */}
            <View style={styles.legend}>
                {[...SLEEP_STAGES].reverse().map(stage => (
                    <View key={stage} style={styles.item}>
                        <View style={[styles.dot, { backgroundColor: colors[stage] }]} />
                        <Text variant="caption" tone="muted">{STAGE_NAME[stage]}</Text>
                        <Text variant="caption" numeric>{formatSleep(night.stages[stage])}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    chart: { flexDirection: 'row', gap: Spacing.sm },
    lanes: { gap: LANE_GAP },
    laneName: { height: LANE, justifyContent: 'center' },
    plot: { flex: 1, gap: Spacing.xs },
    axis: { flexDirection: 'row', justifyContent: 'space-between' },
    legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.xs, columnGap: Spacing.lg },
    item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    dot: { width: Spacing.sm, height: Spacing.sm, borderRadius: Spacing.xs },
});
