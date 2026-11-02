import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { AppIcon, Text } from '@/components/ui';
import { AnimatedFill, AnimatedPath, PopIn, useCountUp, useProgress } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { COMPOUND, LIFE_YEARS, SKILLS, TRADE_MINUTES, screenYears, yearsLabel, type Answers } from '@/lib/ascent/story';
import { Control, Radius, Spacing } from '@/theme/designSystem';

/**
 * What Echo shapeshifts into while it tells the story (lib/ascent/story.ts
 * `stage`): the day as a 24-hour ring, a life as dots, thirty minutes traded,
 * motivation against discipline, and 1% compounding. Each is worked out from
 * their answers, never made up, and moves in with the app's own motion (it
 * draws, counts and pops in; with Reduce Motion it simply shows).
 *
 * When Echo's final form (a shapeless ripple that can become anything) is
 * drawn, it morphs into these; until then the stage crossfades between them.
 */

/** The height every explainer is drawn to, so the line under it never moves. */
export const STAGE_HEIGHT = Spacing.section * 7;

const useWidth = () => Math.min(useWindowDimensions().width - Spacing.xl * 2, Spacing.section * 12);

/* -------------------------------------------------------------------------- */
/*  The day: 24 hours                                                          */
/* -------------------------------------------------------------------------- */

const polar = (cx: number, cy: number, r: number, hour: number) => {
    const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
};

/** One hour of the ring, from `outer` to `inner`, with a hairline gap either side. */
const hourArc = (c: number, outer: number, inner: number, hour: number) => {
    const gap = 0.06;
    const a = polar(c, c, outer, hour + gap), b = polar(c, c, outer, hour + 1 - gap);
    const d = polar(c, c, inner, hour + 1 - gap), e = polar(c, c, inner, hour + gap);
    return `M${a.x},${a.y} A${outer},${outer} 0 0 1 ${b.x},${b.y} L${d.x},${d.y} A${inner},${inner} 0 0 0 ${e.x},${e.y} Z`;
};

/** Whether this hour is spent awake, for a day from `wake` to `sleep` (which may pass midnight). */
export function awakeAt(hour: number, wake: string, sleep: string): boolean {
    const hoursOf = (time: string) => { const [h, m] = time.split(':').map(Number); return (h || 0) + (m || 0) / 60; };
    const start = hoursOf(wake), end = hoursOf(sleep);
    const middle = hour + 0.5;
    return start <= end ? middle >= start && middle < end : middle >= start || middle < end;
}

function HourCell({ index, d, fill, shown }: { index: number; d: string; fill: string; shown: SharedValue<number> }) {
    // Each hour lights after the one before, as the ring is drawn round.
    const props = useAnimatedProps(() => ({ opacity: Math.max(0, Math.min(1, shown.get() * 24 - index)) }));
    return <AnimatedPath d={d} fill={fill} animatedProps={props} />;
}

export function ClockExplainer({ answers, color }: { answers: Answers; color: string }) {
    const t = useTokens();
    const size = STAGE_HEIGHT - Spacing.xxl * 2;
    const c = size / 2, outer = c - Spacing.xs, inner = outer - Spacing.lg;
    const wake = answers.wake ?? '07:00', sleep = answers.sleep ?? '23:00';
    const awake = Array.from({ length: 24 }, (_, hour) => awakeAt(hour, wake, sleep));
    const hoursAwake = awake.filter(Boolean).length;
    const shown = useProgress(1, 0, `${wake}-${sleep}`);
    const now = new Date();
    const hand = polar(c, c, inner - Spacing.sm, now.getHours() + now.getMinutes() / 60);
    return (
        <View style={styles.center} accessible accessibilityRole="image"
            accessibilityLabel={`A 24-hour day: ${hoursAwake} hours awake, ${24 - hoursAwake} asleep.`}>
            <View>
                <Svg width={size} height={size}>
                    {awake.map((up, hour) => (
                        <HourCell key={hour} index={hour} d={hourArc(c, outer, inner, hour)} fill={up ? color : t.color.surfaceRaised} shown={shown} />
                    ))}
                    {/* Now: the one hand, where today is. */}
                    <Line x1={c} y1={c} x2={hand.x} y2={hand.y} stroke={t.color.textPrimary} strokeWidth={Spacing.xs / 2} strokeLinecap="round" />
                    <Circle cx={c} cy={c} r={Spacing.xs} fill={t.color.textPrimary} />
                </Svg>
            </View>
            <View style={styles.legend}>
                <Swatch fill={color} label={`Awake ${hoursAwake} h`} />
                <Swatch fill={t.color.surfaceRaised} label={`Asleep ${24 - hoursAwake} h`} />
            </View>
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*  A life: the years a screen takes                                           */
/* -------------------------------------------------------------------------- */

const PER_ROW = 10;

export function LifetimeExplainer({ answers, color }: { answers: Answers; color: string }) {
    const t = useTokens();
    const { years, lived, left } = screenYears(answers);
    const screen = Math.min(left, Math.max(years >= 0.5 ? 1 : 0, Math.round(years)));
    const figure = useCountUp(String(years < 1 ? Math.max(1, Math.round(years * 12)) : years), years);
    const unit = yearsLabel(years).replace(/^[\d.]+ /, '');
    const dot = Spacing.md, gap = Spacing.xs + Spacing.xs / 2;
    return (
        <View style={styles.center} accessible accessibilityRole="image"
            accessibilityLabel={`${yearsLabel(years)} on a screen, of the ${left} years until ${LIFE_YEARS}.`}>
            <View style={styles.figure}>
                <Text variant="display" tone="danger">{figure}</Text>
                <Text variant="heading" tone="muted">{unit} on a screen</Text>
            </View>
            <View style={[styles.dots, { width: PER_ROW * dot + (PER_ROW - 1) * gap, gap }]}>
                {Array.from({ length: LIFE_YEARS }, (_, year) => {
                    const kind = year < lived ? 'lived' : year >= LIFE_YEARS - screen ? 'screen' : 'yours';
                    // Shape as well as colour: lived years are dim dots, screen years squares, yours open rings.
                    const look = kind === 'lived'
                        ? { backgroundColor: t.color.surfaceRaised, borderRadius: Radius.pill }
                        : kind === 'screen'
                            ? { backgroundColor: t.color.danger, borderRadius: Spacing.xs / 2 }
                            : { borderWidth: Spacing.xs / 2, borderColor: color, borderRadius: Radius.pill };
                    return <PopIn key={year} index={year} style={[{ width: dot, height: dot }, look]} />;
                })}
            </View>
            <View style={styles.legend}>
                <Swatch fill={t.color.surfaceRaised} label="Lived" />
                <Swatch ring={color} label="Still yours" />
                <Swatch fill={t.color.danger} square label="Screen" />
            </View>
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*  Thirty minutes, traded                                                     */
/* -------------------------------------------------------------------------- */

export function TradeExplainer({ answers, color }: { answers: Answers; color: string }) {
    const t = useTokens();
    const skill = SKILLS[answers.skill ?? 'morse'];
    const hours = Math.round((skill.days * TRADE_MINUTES) / 60);
    const figure = useCountUp(String(hours), answers.skill);
    const outcome = skill.outcome.charAt(0).toUpperCase() + skill.outcome.slice(1);
    return (
        <View style={[styles.center, styles.trade, { width: useWidth() }]} accessible accessibilityRole="image"
            accessibilityLabel={`${hours} hours over ${skill.days} days. Scrolling: nothing kept. ${skill.label}: ${outcome}.`}>
            <View style={styles.figure}>
                <Text variant="display">{figure}</Text>
                <Text variant="heading" tone="muted">hours in {skill.days} days</Text>
            </View>
            <TradeRow icon="phone-portrait" label="Scrolling" result="Nothing kept" fill={t.color.textSubtle} track={t.color.surfaceRaised} replay={answers.skill} />
            <TradeRow icon={skill.icon} label={skill.label} result={outcome} fill={color} track={t.color.surfaceRaised} replay={answers.skill} accent />
        </View>
    );
}

function TradeRow({ icon, label, result, fill, track, replay, accent }: {
    icon: string; label: string; result: string; fill: string; track: string; replay?: unknown; accent?: boolean;
}) {
    return (
        <View style={styles.row}>
            <View style={styles.rowHead}>
                <AppIcon name={icon} filled size={Control.icon} color={fill} />
                <View style={styles.grow}><Text variant="heading">{label}</Text></View>
                <View style={styles.result}><Text variant="bodySmall" tone={accent ? 'accent' : 'muted'} align="right">{result}</Text></View>
            </View>
            <View style={[styles.track, { backgroundColor: track }]}>
                <AnimatedFill progress={1} replay={replay} style={[styles.fill, { backgroundColor: fill }]} />
            </View>
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*  Motivation against discipline, and 1% a day                                */
/* -------------------------------------------------------------------------- */

type Point = [number, number];
const pathOf = (points: Point[]) => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const lengthOf = (points: Point[]) => points.reduce((sum, [x, y], index) => (index ? sum + Math.hypot(x - points[index - 1][0], y - points[index - 1][1]) : 0), 0);

/** A line drawn in from its start, the way a chart arrives. */
function DrawnLine({ points, stroke, show = true, width = Spacing.xs }: { points: Point[]; stroke: string; show?: boolean; width?: number }) {
    const length = lengthOf(points);
    const drawn = useProgress(show ? 1 : 0);
    const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.get()) }));
    return <AnimatedPath d={pathOf(points)} stroke={stroke} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={[length, length]} animatedProps={props} />;
}

const sample = (count: number, y: (x: number) => number, width: number, height: number): Point[] =>
    Array.from({ length: count + 1 }, (_, index) => {
        const x = index / count;
        return [Spacing.xs + x * (width - Spacing.xs * 2), height - Spacing.xs - y(x) * (height - Spacing.xs * 2)];
    });

/** Motivation: a spike at the start, then it fades, with the odd flicker. */
const motivation = (x: number) => Math.max(0.04, 0.95 * Math.exp(-((x - 0.12) ** 2) / 0.004) + 0.25 * Math.exp(-((x - 0.5) ** 2) / 0.002) + 0.12 * Math.exp(-((x - 0.78) ** 2) / 0.0015) + 0.04);
/** Discipline: small and steady, and it keeps going up. */
const discipline = (x: number) => 0.04 + 0.86 * x;

export function MotivationExplainer({ color, both }: { color: string; both: boolean }) {
    const t = useTokens();
    const width = useWidth(), height = STAGE_HEIGHT - Spacing.section * 2;
    return (
        <View style={styles.center} accessible accessibilityRole="image"
            accessibilityLabel={both ? 'Motivation spikes then fades. Discipline rises steadily and ends higher.' : 'Motivation spikes, then fades.'}>
            <Svg width={width} height={height}>
                <Line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={t.color.border} strokeWidth={1} />
                <DrawnLine points={sample(80, motivation, width, height)} stroke={t.color.textSubtle} />
                <DrawnLine points={sample(2, discipline, width, height)} stroke={color} show={both} />
            </Svg>
            <View style={styles.legend}>
                <Swatch fill={t.color.textSubtle} label="Motivation" />
                {both ? <Swatch fill={color} label="Discipline" /> : null}
            </View>
        </View>
    );
}

export function CompoundExplainer({ color }: { color: string }) {
    const t = useTokens();
    const width = useWidth(), height = STAGE_HEIGHT - Spacing.section * 3;
    const top = 1.01 ** 365;
    const better = useCountUp(`${COMPOUND.better}×`);
    return (
        <View style={styles.center} accessible accessibilityRole="image"
            accessibilityLabel={`1% better every day for a year: ${COMPOUND.better} times. 1% worse: ${COMPOUND.worse} times.`}>
            <View style={styles.figure}>
                <Text variant="display" tone="accent">{better}</Text>
                <Text variant="heading" tone="muted">1% better a day, for a year</Text>
            </View>
            <Svg width={width} height={height}>
                <Line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={t.color.border} strokeWidth={1} />
                <DrawnLine points={sample(60, x => 0.99 ** (x * 365) / top, width, height)} stroke={t.color.textSubtle} />
                <DrawnLine points={sample(60, x => 1.01 ** (x * 365) / top, width, height)} stroke={color} />
            </Svg>
            <View style={styles.legend}>
                <Swatch fill={color} label={`1% better: ${COMPOUND.better}×`} />
                <Swatch fill={t.color.textSubtle} label={`1% worse: ${COMPOUND.worse}×`} />
            </View>
        </View>
    );
}

/* -------------------------------------------------------------------------- */

function Swatch({ fill, ring, square, label }: { fill?: string; ring?: string; square?: boolean; label: string }) {
    const look = ring
        ? { borderWidth: Spacing.xs / 2, borderColor: ring, borderRadius: Radius.pill }
        : { backgroundColor: fill, borderRadius: square ? Spacing.xs / 2 : Radius.pill };
    return (
        <View style={styles.swatch}>
            <View style={[styles.swatchMark, look]} />
            <Text variant="caption" tone="muted">{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    figure: { alignItems: 'center' },
    dots: { flexDirection: 'row', flexWrap: 'wrap' },
    legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.lg },
    swatch: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + Spacing.xs / 2 },
    swatchMark: { width: Spacing.sm + Spacing.xs / 2, height: Spacing.sm + Spacing.xs / 2 },
    trade: { alignItems: 'stretch', gap: Spacing.lg },
    row: { gap: Spacing.sm },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    grow: { flex: 1 },
    result: { flexShrink: 1 },
    track: { height: Spacing.sm, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
});
