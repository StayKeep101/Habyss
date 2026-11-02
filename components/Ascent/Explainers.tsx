import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { AppIcon, MatteSurface, Text } from '@/components/ui';
import { AnimatedPath, useCountUp, useProgress } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { COMPOUND, LIFE_YEARS, SKILLS, TRADE_MINUTES, awakeHours, grouped, screenTime, type Answers } from '@/lib/ascent/story';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE, STAGGER } from '@/theme/motion';

/**
 * What Echo shapeshifts into while it tells the story (lib/ascent/story.ts
 * `stage` and `step`). Each is built like a slide: its pieces arrive one
 * after another on their own cue (a number, a sign, a cube, a label), and a
 * line's `step` brings on the next part as the conversation moves, so it
 * plays like a short film rather than a chart. Everything is worked out from
 * their answers and laid out inside the size it is given, so nothing is cut.
 * With Reduce Motion, the pieces simply appear.
 */

export interface ExplainerProps { answers: Answers; color: string; step: number; width: number; height: number }

/** The gap between two pieces of a slide arriving. */
const CUE = STAGGER.stage * 3;
/** How long a line takes to draw itself, or a ring to go round. */
const DRAW = DURATION.reward * 2;

/** One piece of a slide, arriving on its cue. */
function Piece({ at = 0, from = 'below', children, style }: { at?: number; from?: 'below' | 'above' | 'fade'; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    const base = from === 'above' ? FadeInUp : from === 'fade' ? FadeIn : FadeInDown;
    return <Animated.View style={style} entering={base.delay(Math.round(at * CUE)).duration(DURATION.reward).easing(EASE.enter)}>{children}</Animated.View>;
}

/** A slide: its pieces arrive in turn; it fades as the next one comes. */
function Slide({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    return <Animated.View style={[styles.slide, style]} exiting={FadeOut.duration(DURATION.exit).easing(EASE.exit)}>{children}</Animated.View>;
}

/** A figure that counts up once it is on screen. */
function Count({ value, variant = 'display', tone }: { value: string; variant?: 'display' | 'screenTitle' | 'title'; tone?: 'primary' | 'accent' | 'danger' | 'muted' }) {
    return <Text variant={variant} tone={tone} numeric>{useCountUp(value)}</Text>;
}

/** A word or number in its own chip, as an equation is set out. */
function Token({ children, tone }: { children: string; tone?: 'accent' | 'danger' }) {
    return (
        <MatteSurface radius={Radius.small} level="control" style={styles.token}>
            <Text variant="title" tone={tone}>{children}</Text>
        </MatteSurface>
    );
}

/* -------------------------------------------------------------------------- */
/*  Chronos: 24 hours                                                          */
/* -------------------------------------------------------------------------- */

const polar = (c: number, r: number, hour: number) => {
    const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    return { x: c + r * Math.cos(angle), y: c + r * Math.sin(angle) };
};
const hourArc = (c: number, outer: number, inner: number, hour: number) => {
    const gap = 0.07;
    const a = polar(c, outer, hour + gap), b = polar(c, outer, hour + 1 - gap);
    const d = polar(c, inner, hour + 1 - gap), e = polar(c, inner, hour + gap);
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
    // Each hour lights after the one before, as the ring goes round.
    const props = useAnimatedProps(() => ({ opacity: Math.max(0, Math.min(1, shown.get() * 24 - index)) }));
    return <AnimatedPath d={d} fill={fill} animatedProps={props} />;
}

/** A 24-hour ring, drawn round hour by hour; `fills` colours each hour. */
function Ring({ size, fills, delay = 0 }: { size: number; fills: string[]; delay?: number }) {
    const c = size / 2, outer = c - Spacing.xs, inner = outer - Math.max(Spacing.sm, size * 0.12);
    const shown = useProgress(1, delay, undefined, DRAW);
    return (
        <Svg width={size} height={size}>
            {fills.map((fill, hour) => <HourCell key={hour} index={hour} d={hourArc(c, outer, inner, hour)} fill={fill} shown={shown} />)}
        </Svg>
    );
}

export function ClockExplainer({ answers, color, step, width, height }: ExplainerProps) {
    const t = useTokens();
    const wake = answers.wake ?? '07:00', sleep = answers.sleep ?? '23:00';
    const big = Math.min(width, height) - Spacing.xxl;
    if (step === 1) {
        const small = Math.min((width - Spacing.lg * 2) / 3, height - Spacing.section * 2);
        const full = Array.from({ length: 24 }, () => color);
        return (
            <Slide key="everyone">
                <View style={styles.trio} accessible accessibilityRole="image" accessibilityLabel="Everyone gets the same 24 hours: you, me, a billionaire.">
                    {['You', 'Me', 'A billionaire'].map((who, index) => (
                        <Piece key={who} at={index} style={styles.trioItem}>
                            <View style={styles.center}>
                                <Ring size={small} fills={full} delay={index * CUE} />
                                <View style={[StyleSheet.absoluteFill, styles.center]}><Text variant="title">24</Text></View>
                            </View>
                            <Text variant="bodySmall" tone="muted" align="center">{who}</Text>
                        </Piece>
                    ))}
                </View>
            </Slide>
        );
    }
    if (step >= 2) {
        const fills = Array.from({ length: 24 }, (_, hour) => (awakeAt(hour, wake, sleep) ? color : t.color.surfaceRaised));
        const awake = awakeHours(answers);
        const ring = big - Spacing.section * 1.5;
        return (
            <Slide key="yours">
                <View accessible accessibilityRole="image" accessibilityLabel={`Your day: ${awake} hours awake, ${24 - awake} asleep.`} style={styles.center}>
                    <View style={styles.center}>
                        <Ring size={ring} fills={fills} />
                        <View style={[StyleSheet.absoluteFill, styles.center]}>
                            <Piece at={1} style={styles.center}><Count value={`${awake}h`} variant="screenTitle" /></Piece>
                            <Piece at={1.5}><Text variant="caption" tone="muted">awake</Text></Piece>
                        </View>
                    </View>
                    <View style={styles.legend}>
                        <Piece at={2}><Swatch fill={color} label={`Awake ${awake} h`} /></Piece>
                        <Piece at={2.5}><Swatch fill={t.color.surfaceRaised} label={`Asleep ${24 - awake} h`} /></Piece>
                    </View>
                </View>
            </Slide>
        );
    }
    return (
        <Slide key="day">
            <View accessible accessibilityRole="image" accessibilityLabel="A day: 24 hours." style={styles.center}>
                <Ring size={big} fills={Array.from({ length: 24 }, () => color)} />
                <View style={[StyleSheet.absoluteFill, styles.center]}>
                    <Piece at={2} style={styles.center}><Count value="24" /></Piece>
                    <Piece at={2.5}><Text variant="heading" tone="muted">hours</Text></Piece>
                </View>
            </View>
        </Slide>
    );
}

/* -------------------------------------------------------------------------- */
/*  The cost: hours, days, years, and a life in cubes                          */
/* -------------------------------------------------------------------------- */

/** A year as a cube, drawn in three faces so it reads as a solid; `ghost` is its outline only. */
function Cube({ size, color, ghost, amount = 1 }: { size: number; color: string; ghost?: boolean; amount?: number }) {
    const s = size, q = s / 4, h = s / 2;
    if (ghost) {
        return (
            <Svg width={s} height={s}>
                <Polygon points={`${h},1 ${s - 1},${q} ${s - 1},${s - q} ${h},${s - 1} 1,${s - q} 1,${q}`} fill="none" stroke={color} strokeOpacity={0.6} strokeWidth={1} />
            </Svg>
        );
    }
    return (
        <Svg width={s} height={s} opacity={amount < 1 ? 0.35 + amount * 0.65 : 1}>
            <Polygon points={`${h},0 ${s},${q} ${h},${h} 0,${q}`} fill={color} />
            <Polygon points={`0,${q} ${h},${h} ${h},${s} 0,${s - q}`} fill={color} fillOpacity={0.72} />
            <Polygon points={`${h},${h} ${s},${q} ${s},${s - q} ${h},${s}`} fill={color} fillOpacity={0.5} />
        </Svg>
    );
}

export function CostExplainer({ answers, color, step, width, height }: ExplainerProps) {
    const t = useTokens();
    const time = screenTime(answers);
    const danger = t.color.danger;

    if (step === 0) {
        return (
            <Slide key="sum">
                <View style={styles.center} accessible accessibilityRole="image"
                    accessibilityLabel={`${time.perDay} hours times 365 days times ${time.age} years equals ${grouped(time.hours)} hours.`}>
                    <View style={styles.equation}>
                        <Piece at={0}><Token>{`${time.perDay} h`}</Token></Piece>
                        <Piece at={0.6} from="fade"><Text variant="title" tone="muted">×</Text></Piece>
                        <Piece at={1}><Token>365 days</Token></Piece>
                        <Piece at={1.6} from="fade"><Text variant="title" tone="muted">×</Text></Piece>
                        <Piece at={2}><Token>{`${time.age} years`}</Token></Piece>
                    </View>
                    <Piece at={3} from="fade"><Text variant="title" tone="muted">=</Text></Piece>
                    <Piece at={3.4} style={styles.center}>
                        <Count value={grouped(time.hours)} />
                        <Text variant="heading" tone="muted">hours</Text>
                    </Piece>
                </View>
            </Slide>
        );
    }

    if (step === 1) {
        return (
            <Slide key="convert">
                <View style={styles.center} accessible accessibilityRole="image"
                    accessibilityLabel={`${grouped(time.hours)} hours is ${grouped(time.days)} days, which is ${time.years} years.`}>
                    <Piece at={0} style={styles.center}><Count value={grouped(time.hours)} variant="screenTitle" /><Text variant="caption" tone="muted">hours</Text></Piece>
                    <Piece at={0.8} from="fade" style={styles.arrow}><AppIcon name="arrow-down" size={Control.icon} color={t.color.textSubtle} /><Text variant="caption" tone="muted">÷ 24</Text></Piece>
                    <Piece at={1.3} style={styles.center}><Count value={grouped(time.days)} variant="screenTitle" /><Text variant="caption" tone="muted">days</Text></Piece>
                    <Piece at={2.1} from="fade" style={styles.arrow}><AppIcon name="arrow-down" size={Control.icon} color={t.color.textSubtle} /><Text variant="caption" tone="muted">÷ 365</Text></Piece>
                    <Piece at={2.6} style={styles.center}><Count value={time.years.toFixed(2)} tone="danger" /><Text variant="heading" tone="muted">years</Text></Piece>
                </View>
            </Slide>
        );
    }

    if (step === 2) {
        const whole = Math.floor(time.years);
        const part = time.years - whole;
        const count = Math.max(1, whole + (part > 0.05 ? 1 : 0));
        const size = Math.min((width - Spacing.sm * (count - 1)) / Math.max(4, count), height / 2.6, Spacing.section * 2.5);
        return (
            <Slide key="cubes">
                <View style={styles.center} accessible accessibilityRole="image" accessibilityLabel={`${time.years} years, as cubes.`}>
                    <View style={[styles.cubeRow, { gap: Spacing.sm, width }]}>
                        {Array.from({ length: count }, (_, index) => (
                            <Piece key={index} at={index * 0.5} from="above">
                                <Cube size={size} color={danger} amount={index === whole ? part : 1} />
                            </Piece>
                        ))}
                    </View>
                    <Piece at={count * 0.5 + 0.4} style={styles.center}>
                        <Count value={time.years.toFixed(2)} variant="screenTitle" tone="danger" />
                        <Text variant="heading" tone="muted">years, gone to a screen</Text>
                    </Piece>
                </View>
            </Slide>
        );
    }

    // A whole life, one cube a year: lived, still yours, and, at this pace, the screen's.
    const columns = 10, rows = Math.ceil(LIFE_YEARS / columns);
    const gap = Spacing.xs;
    const legend = Spacing.section * 1.5;
    const size = Math.floor(Math.min((width - gap * (columns - 1)) / columns, (height - legend - gap * (rows - 1)) / rows));
    const screenFrom = LIFE_YEARS - Math.round(time.ahead);
    return (
        <Slide key="life">
            <View style={styles.center} accessible accessibilityRole="image"
                accessibilityLabel={step >= 4 ? `A life of ${LIFE_YEARS} years: ${time.age} lived, ${time.ahead} more on a screen at this pace.` : `A life of ${LIFE_YEARS} years, one cube each. ${time.age} lived.`}>
                <View style={[styles.grid, { width: columns * size + (columns - 1) * gap, gap }]}>
                    {Array.from({ length: LIFE_YEARS }, (_, year) => {
                        const lived = year < time.age;
                        const screen = step >= 4 && year >= screenFrom;
                        return (
                            <View key={year} style={{ width: size, height: size }}>
                                <Piece at={year * 0.04} from="above"><Cube size={size} color={lived ? t.color.textSubtle : color} ghost={!lived} /></Piece>
                                {/* At this pace: the years a screen takes, filling in from the end, one after another. */}
                                {screen ? (
                                    <Piece at={(year - screenFrom) * 0.12} from="fade" style={StyleSheet.absoluteFill}><Cube size={size} color={danger} /></Piece>
                                ) : null}
                            </View>
                        );
                    })}
                </View>
                <View style={styles.legend}>
                    <Piece at={1}><Swatch fill={t.color.textSubtle} label={`Lived ${time.age}`} /></Piece>
                    <Piece at={1.4}><Swatch ring={color} label="Still yours" /></Piece>
                    {step >= 4 ? <Piece at={Math.round(time.ahead) * 0.12 + 0.4}><Swatch fill={danger} label={`Screen +${time.ahead}`} /></Piece> : null}
                </View>
            </View>
        </Slide>
    );
}

/* -------------------------------------------------------------------------- */
/*  Thirty minutes, traded                                                     */
/* -------------------------------------------------------------------------- */

function Lane({ icon, label, fill, track, run }: { icon: string; label: string; fill: string; track: string; run: boolean }) {
    const shown = useProgress(run ? 1 : 0, 0, undefined, DRAW * 1.5);
    const width = useAnimatedStyle(() => ({ width: `${shown.get() * 100}%` }));
    return (
        <View style={styles.lane}>
            <View style={styles.laneHead}>
                <AppIcon name={icon} filled size={Control.icon} color={fill} />
                <View style={styles.grow}><Text variant="heading">{label}</Text></View>
                <Text variant="bodySmall" tone="muted">{TRADE_MINUTES} min a day</Text>
            </View>
            <View style={[styles.track, { backgroundColor: track }]}>
                <Animated.View style={[styles.fill, { backgroundColor: fill }, width]} />
            </View>
        </View>
    );
}

export function TradeExplainer({ answers, color, step, width }: ExplainerProps) {
    const t = useTokens();
    const skill = SKILLS[answers.skill ?? 'morse'];
    const hours = Math.round((skill.days * TRADE_MINUTES) / 60);
    const outcome = skill.outcome.charAt(0).toUpperCase() + skill.outcome.slice(1);
    return (
        <Slide key="trade" style={{ width }}>
            <View style={styles.stack} accessible accessibilityRole="image"
                accessibilityLabel={`${TRADE_MINUTES} minutes a day for ${skill.days} days is ${hours} hours. Scrolling: nothing kept. ${skill.label}: ${outcome}.`}>
                <Piece at={0}><Lane icon="phone-portrait" label="Scrolling" fill={t.color.textSubtle} track={t.color.surfaceRaised} run={step >= 1} /></Piece>
                <Piece at={0.6}><Lane icon={skill.icon} label={skill.label} fill={color} track={t.color.surfaceRaised} run={step >= 1} /></Piece>
                {step >= 1 ? (
                    <Piece at={0} style={styles.center}>
                        <Count value={`Day ${skill.days}`} variant="screenTitle" />
                        <Text variant="caption" tone="muted">{`${hours} hours, either way`}</Text>
                    </Piece>
                ) : null}
                {step >= 2 ? (
                    <View style={styles.results}>
                        <Piece at={0} style={styles.grow}>
                            <MatteSurface radius={Radius.control} level="control" style={styles.result}>
                                <AppIcon name="close-circle" filled size={Control.icon} color={t.color.textSubtle} />
                                <Text variant="bodySmall" tone="muted" align="center">Nothing kept</Text>
                            </MatteSurface>
                        </Piece>
                        <Piece at={0.8} style={styles.grow}>
                            <MatteSurface radius={Radius.control} level="control" style={styles.result}>
                                <AppIcon name="checkmark-circle" filled size={Control.icon} color={color} />
                                <Text variant="bodySmall" align="center">{outcome}</Text>
                            </MatteSurface>
                        </Piece>
                    </View>
                ) : null}
            </View>
        </Slide>
    );
}

/* -------------------------------------------------------------------------- */
/*  Motivation, discipline, and 1% a day                                       */
/* -------------------------------------------------------------------------- */

type Point = [number, number];
const pathOf = (points: Point[]) => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const lengthOf = (points: Point[]) => points.reduce((sum, [x, y], index) => (index ? sum + Math.hypot(x - points[index - 1][0], y - points[index - 1][1]) : 0), 0);

/** A line drawn in from its start, slowly, like a pen. */
function DrawnLine({ points, stroke, show = true, delay = 0 }: { points: Point[]; stroke: string; show?: boolean; delay?: number }) {
    const length = lengthOf(points);
    const drawn = useProgress(show ? 1 : 0, delay, undefined, DRAW);
    const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.get()) }));
    return <AnimatedPath d={pathOf(points)} stroke={stroke} strokeWidth={Spacing.xs} fill="none" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={[length, length]} animatedProps={props} />;
}

/** Padding inside every chart, wide enough that no stroke, dot or label reaches an edge. */
const PAD = Spacing.xl;
const sample = (count: number, y: (x: number) => number, width: number, height: number): Point[] =>
    Array.from({ length: count + 1 }, (_, index) => {
        const x = index / count;
        return [PAD + x * (width - PAD * 2), height - PAD - y(x) * (height - PAD * 2)];
    });

const motivation = (x: number) => Math.max(0.03, 0.92 * Math.exp(-((x - 0.14) ** 2) / 0.005) + 0.22 * Math.exp(-((x - 0.52) ** 2) / 0.0025) + 0.1 * Math.exp(-((x - 0.8) ** 2) / 0.0015) + 0.03);
const discipline = (x: number) => 0.03 + 0.8 * x;

/** A label pinned above a point of the chart, kept inside it. */
function Pin({ x, y, width, children, at, align = 'center' }: { x: number; y: number; width: number; children: React.ReactNode; at: number; align?: 'center' | 'right' }) {
    const box = Spacing.section * 4;
    const left = align === 'right' ? Math.max(0, Math.min(width - box, x - box + Spacing.sm)) : Math.max(0, Math.min(width - box, x - box / 2));
    return (
        <Piece at={at} from="fade" style={[styles.pin, { left, top: Math.max(0, y - Spacing.xxl - Spacing.sm), width: box, alignItems: align === 'right' ? 'flex-end' : 'center' }]}>
            {children}
        </Piece>
    );
}

export function MotivationExplainer({ color, step, width, height }: ExplainerProps) {
    const t = useTokens();
    const chart = height - Spacing.section;
    const spike = sample(80, motivation, width, chart);
    const steady = sample(2, discipline, width, chart);
    const peak = spike.reduce((top, point) => (point[1] < top[1] ? point : top), spike[0]);
    const end = steady[steady.length - 1];
    return (
        <Slide key="motivation">
            <View accessible accessibilityRole="image"
                accessibilityLabel={step >= 1 ? 'Motivation spikes then fades. Discipline rises steadily and ends higher.' : 'Motivation spikes, then fades.'}>
                <View style={{ width, height: chart }}>
                    <Svg width={width} height={chart}>
                        <Line x1={PAD} y1={chart - PAD} x2={width - PAD} y2={chart - PAD} stroke={t.color.border} strokeWidth={1} />
                        <DrawnLine points={spike} stroke={t.color.textSubtle} delay={CUE} />
                        <DrawnLine points={steady} stroke={color} show={step >= 1} />
                        {step >= 1 ? <Circle cx={end[0]} cy={end[1]} r={Spacing.xs + 1} fill={color} /> : null}
                    </Svg>
                    <Pin x={peak[0]} y={peak[1]} width={width} at={2.5}><Text variant="bodySmall" tone="muted">Motivation</Text></Pin>
                    {step >= 1 ? <Pin x={end[0]} y={end[1]} width={width} at={2} align="right"><Text variant="bodySmall" tone="accent">Discipline</Text></Pin> : null}
                </View>
                <View style={styles.legend}>
                    <Piece at={0.5}><Text variant="caption" tone="muted">Time →</Text></Piece>
                </View>
            </View>
        </Slide>
    );
}

export function CompoundExplainer({ color, step, width, height }: ExplainerProps) {
    const t = useTokens();
    const top = 1.01 ** 365;
    const chart = height - Spacing.section * 3;
    const better = sample(60, x => 1.01 ** (x * 365) / top, width, chart);
    const worse = sample(60, x => 0.99 ** (x * 365) / top, width, chart);
    const end = better[better.length - 1];
    return (
        <Slide key="compound">
            <View style={styles.center} accessible accessibilityRole="image"
                accessibilityLabel={`1% better every day for a year: ${COMPOUND.better} times. 1% worse: ${COMPOUND.worse} times.`}>
                <View style={styles.equation}>
                    <Piece at={0}><Token tone="accent">1% a day</Token></Piece>
                    <Piece at={0.6} from="fade"><Text variant="title" tone="muted">×</Text></Piece>
                    <Piece at={1}><Token>365 days</Token></Piece>
                    {step >= 1 ? <Piece at={0} from="fade"><Text variant="title" tone="muted">=</Text></Piece> : null}
                    {step >= 1 ? <Piece at={0.3}><Count value={`${COMPOUND.better}×`} variant="screenTitle" tone="accent" /></Piece> : null}
                </View>
                {step >= 1 ? (
                    <View style={{ width, height: chart }}>
                        <Svg width={width} height={chart}>
                            <Line x1={PAD} y1={chart - PAD} x2={width - PAD} y2={chart - PAD} stroke={t.color.border} strokeWidth={1} />
                            <DrawnLine points={worse} stroke={t.color.textSubtle} delay={CUE} />
                            <DrawnLine points={better} stroke={color} delay={CUE} />
                        </Svg>
                        <Pin x={end[0]} y={end[1]} width={width} at={3} align="right"><Text variant="bodySmall" tone="accent">{`1% better: ${COMPOUND.better}×`}</Text></Pin>
                        <Pin x={width - PAD} y={chart - PAD} width={width} at={3.4} align="right"><Text variant="bodySmall" tone="muted">{`1% worse: ${COMPOUND.worse}×`}</Text></Pin>
                    </View>
                ) : null}
            </View>
        </Slide>
    );
}

/* -------------------------------------------------------------------------- */

function Swatch({ fill, ring, label }: { fill?: string; ring?: string; label: string }) {
    const look = ring ? { borderWidth: 1.5, borderColor: ring } : { backgroundColor: fill };
    return (
        <View style={styles.swatch}>
            <View style={[styles.swatchMark, look]} />
            <Text variant="caption" tone="muted">{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    slide: { alignItems: 'center', justifyContent: 'center' },
    center: { alignItems: 'center', justifyContent: 'center' },
    stack: { gap: Spacing.lg, alignSelf: 'stretch' },
    equation: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    token: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    arrow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
    cubeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: Spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    trio: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: Spacing.lg },
    trioItem: { alignItems: 'center', gap: Spacing.sm },
    legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.lg, marginTop: Spacing.md },
    swatch: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + Spacing.xs / 2 },
    swatchMark: { width: Spacing.sm + Spacing.xs / 2, height: Spacing.sm + Spacing.xs / 2, borderRadius: Spacing.xs / 2 },
    lane: { gap: Spacing.sm },
    laneHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    grow: { flex: 1 },
    track: { height: Spacing.sm, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
    results: { flexDirection: 'row', gap: Spacing.sm },
    result: { alignItems: 'center', gap: Spacing.xs, padding: Spacing.md, minHeight: Control.height },
    pin: { position: 'absolute' },
});
