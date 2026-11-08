import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { CountUp } from '@/components/ui/Motion';
import { CEREMONY, EASE, timingFor } from '@/theme/motion';
import { StatusBadge } from '@/components/Community/StatusBadge';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { curveY, placeOn, raceLines, racersShown, type RaceFace, type RaceLine, type Racer } from '@/lib/marksRace';

/** Days of the race drawn: a month, enough to see who is climbing. */
const DAYS = 30;
/** Every line the same weight, yours and your friends': yours is told apart by its colour and its face. */
const LINE = 2;

const dayLabel = (back: number) => {
    const date = new Date();
    date.setDate(date.getDate() - back);
    return back === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * Community's backdrop: your Marks and your friends' over the last month, one
 * line each on one scale, a face at the end of every line. Yours is the
 * accent with a glow under it; everyone else's is silver.
 *
 * Your total sits over the top left. Dragging a finger along it (`scrub`, the
 * finger's x, or −1 when nobody is touching) reads any day, the way a stocks
 * chart does: a line at that day, a dot on everyone's line, and the top left
 * says the day, your total then and your place among friends that day.
 *
 * Once the race has its lines (`replay` turning true), it plays the month
 * through like a film, once: every line draws itself from the left, each face
 * riding the tip of its own line, over the length of the goal ceremony's run
 * to its count (theme/motion.ts). With Reduce Motion it is simply there.
 */
export function MarksRace({ racers, width, height, top, scrub, onFaces, style, replay }: {
    racers: Racer[];
    width: number;
    height: number;
    /** Where the writing starts: under the status bar. */
    top: number;
    scrub: SharedValue<number>;
    /** Where every face is drawn, so the page can open the one tapped. */
    onFaces?: (faces: RaceFace[]) => void;
    style?: StyleProp<ViewStyle>;
    replay?: unknown;
}) {
    const t = useTokens();
    const face = t.space['3xl'];
    const mine = face + t.space.sm;
    // Just enough room on the right for the faces at the ends of the lines.
    const gutter = mine / 2 + t.space.sm;
    const shown = useMemo(() => racersShown(racers), [racers]);
    // Below your total, above the page's edge.
    const linesTop = top + t.space['4xl'] * 2 + t.space.lg;
    const lines = useMemo(() => raceLines(shown, {
        width, height, days: DAYS, gutter,
        top: linesTop, bottom: height - mine,
        gap: face + t.space.xs,
    }), [shown, width, height, face, mine, gutter, linesTop, t.space]);
    const me = lines.find(line => line.me);
    // Yours drawn last, on top.
    const ordered = useMemo(() => [...lines].sort((a, b) => Number(a.me) - Number(b.me)), [lines]);

    useEffect(() => {
        onFaces?.(lines.map(line => ({ id: line.id, me: line.me, x: line.face.x, y: line.face.y, size: line.me ? mine : face })));
    }, [lines, onFaces, mine, face]);

    // The day under the finger, worked out on the UI thread and drawn only when it changes,
    // with a tick for every day crossed, the way a stocks chart reads.
    const { selectionFeedback } = useHaptics();
    const [day, setDay] = useState<number | null>(null);
    const read = (next: number) => {
        setDay(next < 0 ? null : next);
        if (next >= 0) selectionFeedback();
    };
    const right = width - gutter;
    const step = right / (DAYS - 1);

    // The film: how far through the month it has played, 0 to 1.
    const play = useSharedValue(1);
    const ready = lines.length > 0;
    const played = useRef(false);
    useEffect(() => {
        if (!ready || played.current) return;
        played.current = true;
        play.set(0);
        play.set(withTiming(1, timingFor(CEREMONY.count, EASE.move)));
    }, [replay, ready, play]);
    // The lines show up to where it has played; done, the whole width (nothing clipped).
    const clip = useAnimatedStyle(() => ({ width: play.get() >= 1 ? width : play.get() * right }));
    useAnimatedReaction(
        () => (scrub.get() < 0 ? -1 : Math.max(0, Math.min(DAYS - 1, Math.round(scrub.get() / step)))),
        (next, before) => { if (next !== before) runOnJS(read)(next); },
        [step],
    );
    const reading = day !== null;
    const myThen = reading ? me?.days[day]?.value : undefined;
    const place = reading ? placeOn(lines, day) : null;
    const x = reading ? day * step : 0;

    return (
        <View pointerEvents="none" style={[{ width, height }, style]}
            accessible accessibilityRole="image"
            accessibilityLabel={me ? `Your Marks, ${me.marks}, against your friends over the last ${DAYS} days.` : 'Marks among friends'}>
            <View style={[styles.total, { left: t.space.xl, top }]}>
                <Text style={[t.type.caption, { color: t.color.textSubtle }]}>{reading ? dayLabel(DAYS - 1 - day) : `Your Marks · ${DAYS} days`}</Text>
                {reading ? (
                    <Text style={[t.type.display, { color: t.color.textPrimary }]}>{myThen === undefined ? '—' : Math.round(myThen).toLocaleString()}</Text>
                ) : me ? (
                    <CountUp value={me.marks.toLocaleString()} replay={replay} style={[t.type.display, { color: t.color.textPrimary }]} />
                ) : null}
                {reading && place && place.of > 1 ? (
                    <Text style={[t.type.caption, { color: t.color.textMuted }]}>{`#${place.place} of ${place.of} that day`}</Text>
                ) : null}
            </View>
            <Animated.View style={[styles.clip, { height }, clip]}>
                <Svg width={width} height={height}>
                    <Defs>
                        <SvgGradient id="race-glow" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={t.color.accent} stopOpacity={0.3} />
                            <Stop offset="1" stopColor={t.color.accent} stopOpacity={0} />
                        </SvgGradient>
                    </Defs>
                    {ordered.map(line => line.me && line.area ? <Path key={`${line.id}-area`} d={line.area} fill="url(#race-glow)" /> : null)}
                    {ordered.map(line => line.path ? (
                        <Path key={line.id} d={line.path} fill="none" strokeLinecap="round" strokeLinejoin="round"
                            stroke={line.me ? t.color.accent : t.color.silver}
                            strokeOpacity={line.me ? 1 : 0.45} strokeWidth={LINE} />
                    ) : null)}
                </Svg>
            </Animated.View>
            {/* The day being read: a line down through it and a dot on everyone's line. */}
            {reading ? (
                <View style={StyleSheet.absoluteFill}>
                    <View style={[styles.rule, { left: x, top: linesTop - t.space.lg, bottom: 0, backgroundColor: t.color.textSubtle }]} />
                    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                        {ordered.map(line => {
                            const point = line.days[day];
                            return point ? (
                                <Circle key={`${line.id}-read`} cx={point.x} cy={point.y} r={line.me ? 5 : 3.5}
                                    fill={line.me ? t.color.accent : t.color.silver} stroke={t.color.background} strokeWidth={2} />
                            ) : null;
                        })}
                    </Svg>
                </View>
            ) : null}
            {ordered.map(line => (
                <RacerFace key={line.id} line={line} size={line.me ? mine : face} play={play} right={right} badge={t.space.lg} accent={t.color.accent} />
            ))}
        </View>
    );
}

/**
 * A face at the end of its line. While the month plays, it rides the tip of
 * the line along its curve, appearing where that person's history begins.
 * What they are doing now, as on their profile: a lock and the accent ring
 * while locked in, a dot while live, a moon asleep.
 */
function RacerFace({ line, size, play, right, badge, accent }: {
    line: RaceLine; size: number; play: SharedValue<number>; right: number; badge: number; accent: string;
}) {
    const { curve } = line;
    const startX = curve.kx[0];
    const endX = line.end.x;
    const ride = useAnimatedStyle(() => {
        const tip = Math.min(endX, play.get() * right);
        const x = play.get() >= 1 ? endX : tip;
        const y = play.get() >= 1 ? line.end.y : curveY(curve, x);
        return {
            opacity: play.get() >= 1 ? 1 : Math.max(0, Math.min(1, (play.get() * right - startX) / size + 1)),
            transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }],
        };
    });
    return (
        <Animated.View style={[styles.face, ride]}>
            <Avatar name={line.name} uri={line.avatarUrl} size={size}
                ring={line.me || line.status === 'focus' ? accent : undefined}
                dim={line.status === 'asleep'}
                badge={!line.me && line.status ? <StatusBadge status={line.status} size={badge} /> : undefined} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    clip: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
    total: { position: 'absolute' },
    face: { position: 'absolute', top: 0, left: 0 },
    rule: { position: 'absolute', width: StyleSheet.hairlineWidth },
});
