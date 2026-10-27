import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
// The gesture handler's Pressable for every touch on a row, so the one under
// the finger wins: Focus or the tick no longer also opens the habit behind them.
import { Pressable } from 'react-native-gesture-handler';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MOTION } from '@/components/ui/Motion';
import { AppIcon } from '@/components/ui/AppIcon';
import { CheckPop } from '@/components/ui/CheckPop';
import { ListItem, useProgress } from '@/components/ui/Motion';
import { FocusPill } from '@/components/ui/FocusPill';
import { useTokens } from '@/hooks/useTokens';
import { useAppSettings } from '@/context/AppSettingsContext';
import { clockLabel, dueLabel, lengthLabel, rangeLabel, type DayFlow, type FlowInput, type FlowItem } from '@/lib/dayFlow';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { textOn } from '@/theme/tokens';
import { FontFamily } from '@/theme/designSystem';
import { s, vs } from '@/theme/scale';

/**
 * Each card size the user picked (Settings → Appearance) has its own
 * proportions, so the timeline is as dense or as roomy as the lists.
 */
const SIZES = {
    // `per`: points per minute, one scale for pills and the free time between
    // them, so an hour is always twice as tall as half an hour.
    small: { pill: s(38), min: vs(34), max: vs(280), per: vs(1.1), icon: s(15), ring: s(22), check: s(13), gap: s(10), pad: vs(6), titleType: 'bodySmall' as const },
    standard: { pill: s(46), min: vs(40), max: vs(340), per: vs(1.4), icon: s(18), ring: s(25), check: s(14), gap: s(12), pad: vs(8), titleType: 'body' as const },
    big: { pill: s(54), min: vs(46), max: vs(400), per: vs(1.7), icon: s(21), ring: s(28), check: s(16), gap: s(14), pad: vs(10), titleType: 'heading' as const },
};
type Size = (typeof SIZES)[keyof typeof SIZES];
/** How long one pill takes to fill in the intro's domino run. */
const FILL_MS = 340;
/**
 * At an even speed, so pill after pill reads as one steady pour rather than
 * each one rushing and stopping.
 */
const POUR = Easing.linear;

/** How much of its time has gone: full once over (or done), a part while on, empty ahead. */
const elapsedOf = (item: FlowItem, now: number | null) => item.state === 'done' || item.done || (now !== null && now >= item.end) ? 1
    : now !== null && now > item.start ? (now - item.start) / Math.max(1, item.end - item.start) : 0;

/** Taller for longer things, within reason, so the day reads at a glance. */
/** Height by length on one scale; very short ones keep room for their icon. */
const pillHeight = (size: Size, minutes: number) => Math.max(size.min, Math.min(size.max, minutes * size.per));

/**
 * The day as one continuous routine: each habit and task in time order, a
 * pill of its own colour (taller the longer it takes) joined to the next by a
 * line. The one you are on offers Focus; finish it and the next is
 * yours straight away, with the rest of the chain moved up (lib/dayFlow.ts).
 * Things with no time are fitted into the free gaps by urgency; a green dot
 * marks one that moved since you last opened it. Meals and calendar events
 * sit as fixed blocks with a lock. A habit's pill is round, a task's squarer.
 */
export function DayTimeline({ flow, onToggle, onOpen, onFocus, now, moved, scrubbing, day, wake, sleep, dueToday }: {
    flow: DayFlow;
    /** Waking and bedtime, in minutes from midnight: the day's first and last card. */
    wake?: number;
    sleep?: number;
    /** Open tasks due by this day that are not on it: shown at the top, so a deadline is never missed. */
    dueToday?: FlowInput[];
    /**
     * The day shown. A new day lays its rows in afresh, top to bottom, the same
     * way every time, rather than sliding the last day's rows around.
     */
    day?: string;
    /** Moved since last opened (lib/dayMemory.ts): the green dot. */
    moved?: Record<string, true>;
    /** Showing only what is on at the time under the finger. */
    scrubbing?: boolean;
    onToggle: (item: FlowInput) => void;
    onOpen: (item: FlowInput) => void;
    onFocus: (item: FlowInput) => void;
    /** Minutes from midnight, for "12 min left"; null on another day. */
    now: number | null;
}) {
    const t = useTokens();
    const size = SIZES[useAppSettings().cardSize] ?? SIZES.standard;
    // The intro fills the pills like dominoes: each one fills completely
    // before the next begins, top to bottom, a partly gone one only as far as
    // the clock says. Each knows when its turn comes and how long it takes.
    const turns = React.useMemo(() => {
        let at = 0;
        return flow.timeline.map(item => {
            const share = elapsedOf(item, now);
            const turn = { delay: at, duration: Math.max(1, Math.round(FILL_MS * share)) };
            at += turn.duration;
            return turn;
        });
    }, [flow.timeline, now]);
    const colorOf = (item: FlowInput) => item.color || (item.kind === 'meal' ? t.color.textMuted : item.kind === 'task' ? t.color.warning : t.color.accent);
    const edges = !scrubbing;
    return (
        <View key={day}>
            {/* Due by today and not on today's plan: named first, so the deadline is seen. */}
            {edges && dueToday?.length ? (
                <Chips title="Due today" icon="flag" tint={t.color.warning} items={dueToday} onOpen={onOpen} />
            ) : null}
            {edges && wake !== undefined ? <Edge size={size} icon="sunny" label="Wake up" at={wake} link={flow.timeline.length > 0} /> : null}
            {flow.timeline.length ? flow.timeline.map((item, index) => {
                const next = flow.timeline[index + 1];
                return (
                    <ListItem key={`${item.kind}-${item.id}`} index={index} rise>
                        <Row size={size} item={item} turn={turns[index]} color={colorOf(item)} last={index === flow.timeline.length - 1} first={index === 0}
                            nextColor={next ? colorOf(next) : undefined} nextStart={next?.start} day={day}
                            now={now} updated={!!moved?.[item.id]} onToggle={onToggle} onOpen={onOpen} onFocus={onFocus} />
                    </ListItem>
                );
            }) : (
                <Text style={[t.type.bodySmall, styles.empty, { color: t.color.textSubtle }]}>
                    {scrubbing ? 'Nothing on at this time.' : 'Nothing planned for this day yet.'}
                </Text>
            )}
            {edges && sleep !== undefined ? <Edge size={size} icon="moon" label="Bedtime" at={sleep % 1440} /> : null}
            {/* Bedtime never gives: whatever has no room gets a card of its own, easy to read and to open. */}
            {flow.unfit.length && edges ? (
                <Chips title="No room before bedtime" icon="moon" tint={t.color.textMuted} items={flow.unfit} onOpen={onOpen} />
            ) : null}
        </View>
    );
}

/** Waking or bedtime: a quiet marker at the top or the bottom of the day. */
function Edge({ size, icon, label, at, link }: { size: Size; icon: string; label: string; at: number; link?: boolean }) {
    const t = useTokens();
    return (
        <View style={styles.row} accessibilityLabel={`${label}, ${clockLabel(at)}`}>
            <View style={[styles.rail, { width: size.pill }]}>
                <View style={[styles.edgeDot, { width: size.ring + t.space.sm, height: size.ring + t.space.sm, borderRadius: (size.ring + t.space.sm) / 2, borderColor: t.color.border }]}>
                    <AppIcon name={icon} size={size.check} color={t.color.textMuted} />
                </View>
                {link ? <View style={[styles.link, { backgroundColor: t.color.border }]} /> : null}
            </View>
            <View style={[styles.edgeText, { paddingLeft: size.gap, paddingBottom: link ? size.pad : 0, gap: t.space.xs }]}>
                <Text style={[t.type.bodySmall, styles.name, { color: t.color.textMuted }]}>{label}</Text>
                <Text style={[t.type.caption, { color: t.color.textSubtle }]}>{clockLabel(at)}</Text>
            </View>
        </View>
    );
}

/** A few names as little cards in a row: things due today, or with no room before bedtime. */
function Chips({ title, icon, tint, items, onOpen }: { title: string; icon: string; tint: string; items: FlowInput[]; onOpen: (item: FlowInput) => void }) {
    const t = useTokens();
    return (
        <View style={{ gap: t.space.sm, paddingVertical: t.space.sm }}>
            <View style={[styles.chipsTitle, { gap: t.space.xs }]}>
                <AppIcon name={icon} size={s(12)} color={tint} />
                <Text style={[t.type.caption, styles.name, { color: tint }]}>{title}</Text>
            </View>
            <View style={[styles.chipRow, { gap: t.space.sm }]}>
                {items.map(item => (
                    <Pressable key={`${item.kind}-${item.id}`} onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={`${title}: ${item.title}`}>
                        <MatteSurface radius={item.kind === 'task' ? t.radius.sm : t.radius.full} style={[styles.chip, { paddingHorizontal: t.space.md, paddingVertical: t.space.sm, gap: t.space.xs }]}>
                            <AppIcon name={item.icon || (item.kind === 'task' ? 'checkbox' : 'repeat')} filled size={s(13)} color={item.color || (item.kind === 'task' ? t.color.warning : t.color.accent)} />
                            <Text numberOfLines={1} style={[t.type.bodySmall, styles.name, { color: t.color.textPrimary }]}>{item.title}</Text>
                        </MatteSurface>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

function Row({ size, item, turn, color, nextColor, nextStart, last, first, now, updated, onToggle, onOpen, onFocus, day }: {
    size: Size; item: FlowItem; turn: { delay: number; duration: number }; color: string; nextColor?: string; nextStart?: number; last: boolean; first?: boolean; now: number | null; updated: boolean; day?: string;
    onToggle: (item: FlowInput) => void; onOpen: (item: FlowInput) => void; onFocus: (item: FlowInput) => void;
}) {
    const t = useTokens();
    const height = pillHeight(size, item.end - item.start);
    const meal = !!item.fixed;
    const live = item.state === 'now';
    const done = item.state === 'done';
    const left = live && now !== null ? Math.max(0, item.end - now) : null;
    // Why it is where it is, when it moved: one plain reason. Cut short to
    // fit is the scissors beside its time, not a sentence.
    const cut = !!item.cutFrom && !done;
    const due = item.deadline && day ? dueLabel(item.deadline, day) : null;
    // A calendar event today: how long until it starts, or until it ends while on.
    const eta = item.kind === 'event' && now !== null
        ? now < item.start ? `in ${lengthLabel(item.start - now)}` : now < item.end ? `ends in ${lengthLabel(item.end - now)}` : null
        : null;
    const soon = item.kind === 'event' && now !== null && now < item.start && item.start - now <= 15;
    const moved = done ? null
        : item.shift > 0 && !item.auto ? `${item.shift} min later: the one before ran over`
        : item.shift < 0 && !item.auto ? `${-item.shift} min earlier: the one before finished early`
        : null;
    // How much of its time has gone: full once over (or done), a part while on, empty ahead.
    const elapsed = elapsedOf(item, now);
    // A habit's pill is round; a task's has squarer corners.
    const corner = item.kind === 'task' ? t.radius.sm : size.pill / 2;
    // A change of length grows or shrinks the pill with the same timing the
    // row moves with, so nothing snaps while the list glides.
    const shownHeight = useSharedValue(height);
    React.useEffect(() => {
        shownHeight.set(withTiming(height, { duration: MOTION.duration, easing: MOTION.easing, reduceMotion: ReduceMotion.System }));
    }, [height, shownHeight]);
    const pillStyle = useAnimatedStyle(() => ({ height: shownHeight.get() }));
    // Where now falls in this row, if it does: inside its pill while it is on,
    // in the free time after it before the next one, or above the first.
    const gapHeight = nextStart !== undefined ? Math.min(size.max, Math.max(0, nextStart - item.end) * size.per) : 0;
    const nowAt = now === null ? null
        : now >= item.start && now < item.end ? ((now - item.start) / Math.max(1, item.end - item.start)) * height
        : nextStart !== undefined && now >= item.end && now < nextStart ? height + ((now - item.end) / Math.max(1, nextStart - item.end)) * gapHeight
        : first && now < item.start ? 0
        : null;
    return (
        <View style={styles.row}>
            {nowAt !== null ? <NowLine top={nowAt} rail={size.pill} color={color} /> : null}
            <View style={[styles.rail, { width: size.pill }]}>
                <Pressable onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
                    <Animated.View style={[styles.pill, { width: size.pill, borderRadius: corner, backgroundColor: t.color.surfaceRaised }, pillStyle]}>
                        {/* Matte, like every card: still to come, the plain card
                            surface with its icon in colour; filled from the top in
                            its own colour as its time passes; a soft light over the
                            whole pill. Done keeps its full colour: only the name is struck through. */}
                        <Fill color={color} height={height} progress={elapsed} turn={turn} />
                        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']} locations={[0, 0.7]} style={StyleSheet.absoluteFill} />
                        <AppIcon name={item.icon || (item.kind === 'task' ? 'checkbox' : 'repeat')} filled size={size.icon} color={elapsed >= 0.5 ? t.color.onAccent : color} />
                    </Animated.View>
                </Pressable>
                {/* The line to the next one: this one's colour melting into the
                    next one's, filling as the time between them passes. */}
                {/* Free time before the next one shows as line, on the same
                    scale as the pills: an hour free is a long stretch, back to back is short. */}
                {!last ? <Link from={color} to={nextColor ?? color} progress={linkProgress(item, nextStart, now)} turn={turn}
                    gap={nextStart !== undefined ? Math.min(size.max, Math.max(0, nextStart - item.end) * size.per) : 0} /> : null}
            </View>

            <Pressable onPress={() => onOpen(item)} style={[styles.body, { minHeight: height, paddingLeft: size.gap, paddingBottom: size.pad }]} accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${rangeLabel(item.start, item.end)}${live ? ', now' : ''}`}>
                <View style={styles.text}>
                    <View style={[styles.meta, { gap: t.space.xs }]}>
                        {meal || item.locked ? <AppIcon name="lock-closed" size={s(11)} color={t.color.textSubtle} /> : null}
                        {cut ? <AppIcon name="cut" size={s(11)} color={t.color.textSubtle} accessibilityLabel={`Cut short from ${lengthLabel(item.cutFrom!)} to fit the day`} /> : null}
                        {live ? <Text style={[t.type.caption, styles.nowTag, { color: t.color.accentText }]}>Now</Text> : item.state === 'next' ? (
                            <Text style={[t.type.caption, styles.nowTag, { color: t.color.textMuted }]}>Up next</Text>
                        ) : null}
                        <Text style={[t.type.caption, { color: t.color.textSubtle }]}>
                            {rangeLabel(item.start, item.end)} ({lengthLabel(item.end - item.start)})
                        </Text>
                        {item.repeats ? <AppIcon name="repeat" size={s(12)} color={t.color.textSubtle} /> : null}
                        {eta ? <Text style={[t.type.caption, styles.nowTag, { color: soon || live ? t.color.accentText : t.color.textMuted }]}>{eta}</Text> : null}
                        {due && !done ? (
                            <Text style={[t.type.caption, styles.nowTag, { color: due === 'Due today' || due === 'Overdue' ? t.color.warning : t.color.textMuted }]}>{due}</Text>
                        ) : null}
                        {/* Moved since you last opened it. */}
                        {updated && !done ? <View accessibilityLabel="Rescheduled" style={[styles.dot, { backgroundColor: t.color.success }]} /> : null}
                    </View>
                    <Text numberOfLines={2} style={[t.type[size.titleType], styles.name, { color: done ? t.color.textSubtle : t.color.textPrimary }, done && !meal && styles.struck]}>{item.title}</Text>
                    {moved ? <Text style={[t.type.caption, { color: t.color.textSubtle }]}>{moved}</Text> : null}
                    {live && !meal ? (
                        <View style={[styles.liveRow, { gap: t.space.sm }]}>
                            <FocusPill color={color} label={item.title} onPress={() => onFocus(item)} />
                            {left !== null ? <Text style={[t.type.caption, { color: t.color.textMuted }]}>{left ? `${lengthLabel(left)} left` : 'Over time'}</Text> : null}
                        </View>
                    ) : null}
                </View>
                {meal ? null : <Check size={size} done={done} color={color} onPress={() => onToggle(item)} label={item.title} />}
            </Pressable>
        </View>
    );
}

/** The ring you tap to finish it; it pops when it fills. */
function Check({ size, done, color, onPress, label }: { size: Size; done: boolean; color: string; onPress: () => void; label: string }) {
    const t = useTokens();
    return (
        <Pressable onPress={onPress} hitSlop={t.space.md} accessibilityRole="checkbox" accessibilityState={{ checked: done }}
            accessibilityLabel={done ? `${label}, done` : `Finish ${label}`}>
            <CheckPop active={done} color={color} size={size.ring}>
                <View style={[styles.check, { width: size.ring, height: size.ring, borderRadius: size.ring / 2, borderColor: color, backgroundColor: done ? color : undefined }]}>
                    {done ? <AppIcon name="checkmark" size={size.check} color={t.color.onAccent} /> : null}
                </View>
            </CheckPop>
        </Pressable>
    );
}

/** The solid part of a pill: as tall as the share of its time already gone, gliding as the clock moves. */
/**
 * How far the line below an item has filled: the time from its end to the
 * next one's start, gone so far. Back-to-back items fill the moment the next
 * begins; a day that is not today is drawn full.
 */
function linkProgress(item: FlowItem, nextStart: number | undefined, now: number | null): number {
    if (now === null || item.state === 'done' && nextStart !== undefined && now >= nextStart) return 1;
    if (nextStart === undefined) return 0;
    const from = Math.min(item.end, nextStart);
    if (nextStart <= from) return now >= nextStart ? 1 : 0;
    return Math.max(0, Math.min(1, (now - from) / (nextStart - from)));
}

/**
 * The line between two items. It runs under both pills, so it meets them with
 * no gap; the part already lived is coloured, this item's colour blending into
 * the next one's, and the rest is the quiet track.
 */
function Link({ from, to, progress, turn, gap = 0 }: { from: string; to: string; progress: number; turn: { delay: number; duration: number }; gap?: number }) {
    const t = useTokens();
    const [length, setLength] = useState(0);
    const shown = useProgress(Math.max(0, Math.min(1, progress)), turn.delay + turn.duration, undefined, turn.duration, POUR);
    const style = useAnimatedStyle(() => ({ height: shown.get() * length }));
    // The line tucks s(10) under each pill, so free time adds that back to show at its true length.
    const target = gap > 0 ? gap + s(20) : vs(10);
    const minHeight = useSharedValue(target);
    React.useEffect(() => {
        minHeight.set(withTiming(target, { duration: MOTION.duration, easing: MOTION.easing, reduceMotion: ReduceMotion.System }));
    }, [target, minHeight]);
    const lengthStyle = useAnimatedStyle(() => ({ minHeight: minHeight.get() }));
    return (
        <Animated.View style={[styles.link, { backgroundColor: t.color.border }, lengthStyle]} onLayout={event => setLength(event.nativeEvent.layout.height)}>
            <Animated.View pointerEvents="none" style={[styles.linkFill, style]}>
                <LinearGradient colors={[from, to]} style={{ height: length }} />
            </Animated.View>
        </Animated.View>
    );
}

function Fill({ color, height, progress, turn }: { color: string; height: number; progress: number; turn: { delay: number; duration: number } }) {
    // Arriving (a page opened, a day switched), it waits for the pill above to
    // be full, then fills; after that it glides with the clock.
    const shown = useProgress(Math.max(0, Math.min(1, progress)), turn.delay, undefined, turn.duration, POUR);
    const style = useAnimatedStyle(() => ({ height: shown.get() * height }));
    // A little lighter at the top, its own colour below: the matte card's light.
    return (
        <Animated.View pointerEvents="none" style={[styles.fill, { backgroundColor: color }, style]}>
            <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} style={{ height }} />
        </Animated.View>
    );
}

/**
 * Now, on the rail: the time to the second in a small chip of the colour it
 * sits on, riding down the line as the day goes. Its own clock, so only it
 * redraws each second.
 */
function NowLine({ top, rail, color }: { top: number; rail: number; color: string }) {
    const [clock, setClock] = useState(() => new Date());
    React.useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        const align = setTimeout(() => { setClock(new Date()); timer = setInterval(() => setClock(new Date()), 1000); }, 1000 - (Date.now() % 1000));
        return () => { clearTimeout(align); if (timer) clearInterval(timer); };
    }, []);
    const pad = (n: number) => String(n).padStart(2, '0');
    const text = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;
    const chip = s(66);
    return (
        <View pointerEvents="none" style={[styles.now, { top: top - s(10), left: rail / 2 - chip / 2, width: chip }]} accessibilityLabel={`Now, ${text.slice(0, 5)}`}>
            <View style={[styles.nowLabel, { backgroundColor: color }]}>
                <Text style={[styles.nowText, { color: textOn(color) }]}>{text}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'stretch' },
    rail: { alignItems: 'center' },
    pill: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 1 },
    // The now chip sits on the rail, centred on its own height of s(20).
    now: { position: 'absolute', height: s(20), alignItems: 'center', justifyContent: 'center', zIndex: 5 },
    nowLabel: { height: s(20), paddingHorizontal: s(6), borderRadius: s(10), justifyContent: 'center' },
    nowText: { fontSize: 11, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    fill: { position: 'absolute', top: 0, left: 0, right: 0 },
    // Runs a little under the pill above and the one below, so the line meets
    // them with no gap; the pills are drawn over it.
    link: { width: s(4), flex: 1, minHeight: vs(10), marginTop: -s(10), marginBottom: -s(10), zIndex: -1, overflow: 'hidden' },
    linkFill: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
    // Beside its pill, even when free time below makes the row taller.
    body: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
    name: { fontFamily: FontFamily.semibold },
    text: { flex: 1, gap: vs(2) },
    meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    nowTag: { fontFamily: FontFamily.semibold },
    struck: { textDecorationLine: 'line-through' },
    liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(6) },
    dot: { width: s(7), height: s(7), borderRadius: s(3.5) },
    edgeDot: { borderWidth: s(1.5), alignItems: 'center', justifyContent: 'center' },
    edgeText: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: vs(34) },
    chipsTitle: { flexDirection: 'row', alignItems: 'center' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: { flexDirection: 'row', alignItems: 'center', maxWidth: s(220) },
    check: { borderWidth: s(2), alignItems: 'center', justifyContent: 'center' },
    empty: { textAlign: 'center', paddingVertical: vs(24) },
});
