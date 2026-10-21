import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
// The gesture handler's Pressable for every touch on a row, so the one under
// the finger wins: Focus or the tick no longer also opens the habit behind them.
import { Pressable } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { CheckPop } from '@/components/ui/CheckPop';
import { ListItem, useProgress } from '@/components/ui/Motion';
import { FocusPill } from '@/components/ui/FocusPill';
import { useTokens } from '@/hooks/useTokens';
import { useAppSettings } from '@/context/AppSettingsContext';
import { lengthLabel, rangeLabel, type DayFlow, type FlowInput, type FlowItem } from '@/lib/dayFlow';
import { FontFamily } from '@/theme/designSystem';
import { s, vs } from '@/theme/scale';

/**
 * Each card size the user picked (Settings → Appearance) has its own
 * proportions, so the timeline is as dense or as roomy as the lists.
 */
const SIZES = {
    small: { pill: s(38), min: vs(42), max: vs(90), per: 0.45, icon: s(15), ring: s(22), check: s(13), gap: s(10), pad: vs(6), titleType: 'bodySmall' as const },
    standard: { pill: s(46), min: vs(50), max: vs(116), per: 0.6, icon: s(18), ring: s(25), check: s(14), gap: s(12), pad: vs(8), titleType: 'body' as const },
    big: { pill: s(54), min: vs(58), max: vs(140), per: 0.75, icon: s(21), ring: s(28), check: s(16), gap: s(14), pad: vs(10), titleType: 'heading' as const },
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
const pillHeight = (size: Size, minutes: number) => Math.max(size.min, Math.min(size.max, size.min + (minutes - 30) * size.per));

/**
 * The day as one continuous routine: each habit and task in time order, a
 * pill of its own colour (taller the longer it takes) joined to the next by a
 * line. The one you are on offers Focus; finish it and the next is
 * yours straight away, with the rest of the chain moved up (lib/dayFlow.ts).
 * Things with no time are fitted into the free gaps by urgency; a green dot
 * marks one that moved since you last opened it. Meals and calendar events
 * sit as fixed blocks with a lock. A habit's pill is round, a task's squarer.
 */
export function DayTimeline({ flow, onToggle, onOpen, onFocus, now, moved, scrubbing, day }: {
    flow: DayFlow;
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
    return (
        <View key={day}>
            {flow.timeline.length ? flow.timeline.map((item, index) => (
                <ListItem key={`${item.kind}-${item.id}`} index={index} rise>
                    <Row size={size} item={item} turn={turns[index]} color={colorOf(item)} last={index === flow.timeline.length - 1}
                        nextColor={flow.timeline[index + 1] ? colorOf(flow.timeline[index + 1]) : undefined}
                        now={now} updated={!!moved?.[item.id]} onToggle={onToggle} onOpen={onOpen} onFocus={onFocus} />
                </ListItem>
            )) : (
                <Text style={[t.type.bodySmall, styles.empty, { color: t.color.textSubtle }]}>
                    {scrubbing ? 'Nothing on at this time.' : 'Nothing planned for this day yet.'}
                </Text>
            )}
            {/* Bedtime never gives: whatever has no room is named, not squeezed in. */}
            {flow.unfit.length && !scrubbing ? (
                <Text style={[t.type.caption, styles.unfit, { color: t.color.textSubtle }]}>
                    {`No room before bedtime for ${flow.unfit.map(item => item.title).join(', ')}.`}
                </Text>
            ) : null}

        </View>
    );
}

function Row({ size, item, turn, color, nextColor, last, now, updated, onToggle, onOpen, onFocus }: {
    size: Size; item: FlowItem; turn: { delay: number; duration: number }; color: string; nextColor?: string; last: boolean; now: number | null; updated: boolean;
    onToggle: (item: FlowInput) => void; onOpen: (item: FlowInput) => void; onFocus: (item: FlowInput) => void;
}) {
    const t = useTokens();
    const height = pillHeight(size, item.end - item.start);
    const meal = !!item.fixed;
    const live = item.state === 'now';
    const done = item.state === 'done';
    const left = live && now !== null ? Math.max(0, item.end - now) : null;
    // Why it is where it is, when it moved: one plain reason.
    const moved = done ? null
        : item.cutFrom ? `Cut from ${lengthLabel(item.cutFrom)} to fit before bedtime`
        : item.shift > 0 && !item.auto ? `${item.shift} min later: the one before ran over`
        : item.shift < 0 && !item.auto ? `${-item.shift} min earlier: the one before finished early`
        : null;
    // How much of its time has gone: full once over (or done), a part while on, empty ahead.
    const elapsed = elapsedOf(item, now);
    // A habit's pill is round; a task's has squarer corners.
    const corner = item.kind === 'task' ? t.radius.sm : size.pill / 2;
    return (
        <View style={styles.row}>
            <View style={[styles.rail, { width: size.pill }]}>
                <Pressable onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
                    <View style={[styles.pill, { width: size.pill, borderRadius: corner, height }]}>
                        {/* A faint tint of its colour, filled from the top as its time passes.
                            Done keeps its full colour: only the name is struck through. */}
                        <View style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: color }]} />
                        <Fill color={color} height={height} progress={elapsed} turn={turn} />
                        <AppIcon name={item.icon || (item.kind === 'task' ? 'checkbox' : 'repeat')} filled size={size.icon} color={elapsed >= 0.5 ? t.color.onAccent : color} />
                    </View>
                </Pressable>
                {!last ? <View style={[styles.link, { backgroundColor: nextColor ?? color }]} /> : null}
            </View>

            <Pressable onPress={() => onOpen(item)} style={[styles.body, { minHeight: height, paddingLeft: size.gap, paddingBottom: size.pad }]} accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${rangeLabel(item.start, item.end)}${live ? ', now' : ''}`}>
                <View style={styles.text}>
                    <View style={[styles.meta, { gap: t.space.xs }]}>
                        {meal || item.locked ? <AppIcon name="lock-closed" size={s(11)} color={t.color.textSubtle} /> : null}
                        {live ? <Text style={[t.type.caption, styles.nowTag, { color: t.color.accentText }]}>Now</Text> : item.state === 'next' ? (
                            <Text style={[t.type.caption, styles.nowTag, { color: t.color.textMuted }]}>Up next</Text>
                        ) : null}
                        <Text style={[t.type.caption, { color: t.color.textSubtle }]}>
                            {rangeLabel(item.start, item.end)} ({lengthLabel(item.end - item.start)})
                        </Text>
                        {item.repeats ? <AppIcon name="repeat" size={s(12)} color={t.color.textSubtle} /> : null}
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
function Fill({ color, height, progress, turn }: { color: string; height: number; progress: number; turn: { delay: number; duration: number } }) {
    // Arriving (a page opened, a day switched), it waits for the pill above to
    // be full, then fills; after that it glides with the clock.
    const shown = useProgress(Math.max(0, Math.min(1, progress)), turn.delay, undefined, turn.duration, POUR);
    const style = useAnimatedStyle(() => ({ height: shown.get() * height }));
    return <Animated.View pointerEvents="none" style={[styles.fill, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'stretch' },
    rail: { alignItems: 'center' },
    pill: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    tint: { opacity: 0.2 },
    fill: { position: 'absolute', top: 0, left: 0, right: 0 },
    link: { width: s(3), flex: 1, minHeight: vs(10), opacity: 0.6 },
    body: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    name: { fontFamily: FontFamily.semibold },
    text: { flex: 1, gap: vs(2) },
    meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    nowTag: { fontFamily: FontFamily.semibold },
    struck: { textDecorationLine: 'line-through' },
    liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(6) },
    dot: { width: s(7), height: s(7), borderRadius: s(3.5) },
    unfit: { paddingTop: vs(8) },
    check: { borderWidth: s(2), alignItems: 'center', justifyContent: 'center' },
    empty: { textAlign: 'center', paddingVertical: vs(24) },
});
