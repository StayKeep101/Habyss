import { GestureDetector } from 'react-native-gesture-handler';
import { HOLD_MS } from '@/components/ui/DragDrop';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
// The gesture handler's Pressable for every touch on a row, so the one under
// the finger wins: Focus or the tick no longer also opens the habit behind them.
import { Pressable } from 'react-native-gesture-handler';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LIST_LAYOUT, ListItem, MOTION } from '@/components/ui/Motion';
import { StruckTitle } from '@/components/ui/StruckTitle';
import { AppIcon } from '@/components/ui/AppIcon';
import { CheckPop } from '@/components/ui/CheckPop';
import type { Face } from '@/components/ui/FaceStack';
import { SharedFaces } from '@/components/Common/SharedFaces';
import type { SharedState } from '@/lib/shared';
import { namesLine } from '@/lib/focusTogether';
import { useHoldDrag } from '@/hooks/useHoldDrag';
import { useTokens } from '@/hooks/useTokens';
import { useAppSettings } from '@/context/AppSettingsContext';
import { LevelTags } from '@/components/ui/LevelTags';
import { waitingLabel, waitingOnOthers } from '@/lib/shared';
import { useInstantToggle } from '@/hooks/useInstantToggle';
import { useHaptics } from '@/hooks/useHaptics';
import { localDateKey } from '@/lib/habitSchedule';
import { useLowPower } from '@/lib/lowPower';
import { clockLabel, dueLabel, isTravel, lengthLabel, rangeLabel, whenLabel, type DayFlow, type FlowInput, type FlowItem } from '@/lib/dayFlow';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { textOn } from '@/theme/tokens';
import { SubtaskList, SubtaskToggle } from '@/components/Tasks/SubtaskDropdown';
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
/**
 * Up to when the day shown has been lived, in its own minutes: now for today,
 * all of it for a day gone, none of it for a day ahead. Every fill on the line
 * (the pills and the links between them) reads this one value, so a day ahead
 * is quiet track all through, as the rest of today is, and fills in only as
 * its time passes.
 */
const livedUntil = (now: number | null, day: string | undefined): number => {
    if (now !== null) return now;
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return day !== undefined && day < today ? Infinity : -Infinity;
};
const share = (lived: number, from: number, to: number) => Math.max(0, Math.min(1, (lived - from) / Math.max(1, to - from)));

/** How much of its time has gone: full once done or over, a part while on, empty ahead. */
const elapsedOf = (item: FlowItem, lived: number) => (item.state === 'done' || item.done ? 1 : share(lived, item.start, item.end));

/** Taller for longer things, within reason, so the day reads at a glance. */
/** Height by length on one scale; very short ones keep room for their icon. */
/** The row's text, growing and shrinking with its pill. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** Every glide inside the timeline: the same beat as its rows' layout (components/ui/Motion.tsx). */
const GLIDE = { duration: MOTION.duration, easing: MOTION.easing, reduceMotion: ReduceMotion.System };

/** A distance down from the top that glides to its new value: centring that moves, never jumps. */
/**
 * On a whole screen pixel: text moved to half a pixel is drawn between two rows of pixels
 * and reads soft, low-res. Centring ((row − text) / 2) lands on fractions all the time.
 */
const PIXEL = PixelRatio.get();
const onPixel = (y: number) => Math.round(y * PIXEL) / PIXEL;

function useGlideY(y: number, glide = true) {
    const to = onPixel(y);
    return useAnimatedStyle(() => ({ transform: [{ translateY: glide ? withTiming(to, GLIDE) : to }] }));
}

/** A colour that fades to its new value instead of switching (a pill filling, a line lived). */
function useTone(color: string) {
    return useAnimatedStyle(() => ({ backgroundColor: withTiming(color, GLIDE) }));
}

/**
 * One scale, like a calendar: an hour is the same height every day, however
 * long the thing or the free time. Only something very short is given room for
 * its name (size.min); nothing is capped any more.
 */
const pillHeight = (size: Size, minutes: number) => Math.max(size.min, minutes * size.per);
const gapHeightOf = (size: Size, minutes: number) => Math.max(0, minutes) * size.per;
/** Free time shorter than this is not labelled: back to back is just a line. */
const FREE_LABEL_MIN = 15;
/** The now chip's height on the rail. */
const NOW_CHIP = s(20);

/**
 * The day as one continuous routine: each habit and task in time order, a
 * pill of its own colour (taller the longer it takes) joined to the next by a
 * line. The one you are on offers Focus; finish it and the next is
 * yours straight away, with the rest of the chain moved up (lib/dayFlow.ts).
 * Things with no time are fitted into the free gaps by urgency; a green dot
 * marks one that moved since you last opened it. Meals and calendar events
 * sit as fixed blocks with a lock. A habit's pill is round, a task's squarer.
 */
export function DayTimeline({ flow, onToggle, onOpen, onFocus, onPin, sharedFor, now, moved, why, scrubbing, appear = 'rise', day, wake, sleep, dueToday, company, onDrag, onDragCancel, dropRef }: {
    /** Who else is on a habit or task (lib/shared.ts): their faces beside its name, as on its list card. */
    sharedFor?: (item: FlowInput) => SharedState | null;
    /** Friends focusing with you, on the card of what you are focusing on (lib/focusTogether.ts). */
    company?: { id: string; faces: Face[] };
    flow: DayFlow;
    /** Waking and bedtime, in minutes from midnight: the day's first and last card. */
    wake?: number;
    sleep?: number;
    onDrag?: (phase: 'start' | 'move' | 'end', item: FlowInput, x: number, y: number) => void;
    onDragCancel?: () => void;
    /** Filled in here: where a held habit or task would land on the line (see TimelineDrop). */
    dropRef?: React.MutableRefObject<TimelineDrop | null>;
    /** Open tasks due by this day that are not on it: shown at the top, so a deadline is never missed. */
    dueToday?: FlowInput[];
    /**
     * The day shown. A new day lays its rows in afresh, top to bottom, the same
     * way every time, rather than sliding the last day's rows around.
     */
    day?: string;
    /** Moved since last opened (lib/dayMemory.ts). */
    moved?: Record<string, true>;
    /** Why each one moved, in a few words, said to VoiceOver until it is opened. */
    why?: Record<string, string>;
    /** Held: set it at an exact time (a habit or task). */
    onPin?: (item: FlowInput) => void;
    /** How the day's rows first appear: rising in (the page opening), or at once (switched to another day). */
    appear?: 'rise' | 'instant';
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
    const lived = livedUntil(now, day);
    // The page's handlers change on every tick; the rows get fixed ones that
    // always call the latest, so a row that did not change need not re-render.
    const latest = useRef({ onToggle, onOpen, onFocus, onPin, onDrag, onDragCancel });
    useLayoutEffect(() => { latest.current = { onToggle, onOpen, onFocus, onPin, onDrag, onDragCancel }; });
    const handlers = useMemo(() => ({
        toggle: (item: FlowInput) => latest.current.onToggle(item),
        open: (item: FlowInput) => latest.current.onOpen(item),
        focus: (item: FlowInput) => latest.current.onFocus(item),
        pin: (item: FlowInput) => latest.current.onPin?.(item),
        drag: (phase: 'start' | 'move' | 'end', item: FlowInput, x: number, y: number) => latest.current.onDrag?.(phase, item, x, y),
        cancel: () => latest.current.onDragCancel?.(),
    }), []);
    // Each row on screen, so a drop can be turned into a time. The ref for each
    // row is made once per row, so re-rendering does not detach and re-attach it.
    const rowViews = useRef(new Map<string, View>());
    const rowItems = useRef(new Map<string, FlowItem>());
    useLayoutEffect(() => {
        rowItems.current = new Map(flow.timeline.map(item => [`${item.kind}-${item.id}${item.part ? `-${item.part.index}` : ''}`, item]));
    }, [flow.timeline]);
    /** Each row registers itself here when it mounts and leaves when it goes. */
    const register = useCallback((key: string, view: View | null) => {
        if (view) rowViews.current.set(key, view); else rowViews.current.delete(key);
    }, []);
    const rowsAt = useRef<{ top: number; bottom: number; item: FlowItem }[]>([]);
    useEffect(() => {
        if (!dropRef) return;
        dropRef.current = {
            measure: () => Promise.all([...rowViews.current.entries()].map(([key, view]) => new Promise<{ top: number; bottom: number; item: FlowItem } | null>(done => {
                const item = rowItems.current.get(key);
                if (!item) { done(null); return; }
                try { view.measureInWindow((_x, y, _w, h) => done(h ? { top: y, bottom: y + h, item } : null)); } catch { done(null); }
            }))).then(found => { rowsAt.current = found.filter((row): row is { top: number; bottom: number; item: FlowItem } => !!row).sort((a, b) => a.top - b.top); }),
            timeAt: (y, id) => dropTime(rowsAt.current, y, id),
        };
        return () => { dropRef.current = null; };
    }, [dropRef]);
    const colorOf = (item: FlowInput) => item.color || (item.kind === 'meal' ? t.color.textMuted : item.kind === 'task' ? t.color.warning : t.color.accent);
    const edges = !scrubbing;
    // Rows rise in one after another only when the day first appears; a row
    // that arrives later (a split, a new task) fades in at once, not after a wait.
    const [arrived, setArrived] = useState(false);
    useEffect(() => { const later = setTimeout(() => setArrived(true), MOTION.intro); return () => clearTimeout(later); }, []);
    return (
        <View>
            {/* Due by today and not on today's plan: named first, so the deadline is seen. */}
            {edges && dueToday?.length ? (
                <Chips label="Due today" items={dueToday} onOpen={onOpen} />
            ) : null}
            {/* Auto-reschedule off: what has no time is not placed for you. A tap ticks it, a long press opens it. */}
            {edges && flow.anytime.length ? (
                <Chips label="Anytime" heading={{ icon: 'time', tint: t.color.textMuted }} items={flow.anytime} onOpen={onOpen} onToggle={onToggle} />
            ) : null}
            {edges && wake !== undefined ? <Edge size={size} icon="sunny" label="Wake up" at={wake} link={flow.timeline.length > 0} /> : null}
            {flow.timeline.length ? flow.timeline.map((item, index) => {
                const next = flow.timeline[index + 1];
                return (
                    <ListItem key={`${item.kind}-${item.id}${item.part ? `-${item.part.index}` : ''}`} index={arrived ? 0 : index} still={!!scrubbing} instant={!arrived && appear === 'instant'} noExit>
                        <TimelineDrag item={item} onDrag={onDrag ? handlers.drag : undefined} onCancel={handlers.cancel}
                            rowKey={`${item.kind}-${item.id}${item.part ? `-${item.part.index}` : ''}`} register={register}><Row size={size} item={item} color={colorOf(item)} last={index === flow.timeline.length - 1} first={index === 0}
                            nextColor={next ? colorOf(next) : undefined} nextStart={next?.start} day={day}
                            now={now} clock={!scrubbing} lived={lived} updated={!!moved?.[item.id]} reason={moved?.[item.id] ? why?.[item.id] : undefined} onToggle={handlers.toggle} onOpen={handlers.open} onFocus={handlers.focus} onPin={onPin ? handlers.pin : undefined}
                            faces={company?.id === item.id ? company.faces : undefined}
                            shared={sharedFor?.(item) ?? null} /></TimelineDrag>
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
                <Chips label="No room before bedtime" heading={{ icon: 'moon', tint: t.color.textMuted }} items={flow.unfit} onOpen={onOpen} />
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
function Chips({ label, heading, items, onOpen, onToggle }: {
    /** What the chips are, for VoiceOver, and shown when there is a heading. */
    label: string;
    /** A small icon and title above the chips; without one, only the chips show. */
    heading?: { icon: string; tint: string };
    items: FlowInput[]; onOpen: (item: FlowInput) => void;
    /** Tickable chips: a tap ticks, a long press opens. */
    onToggle?: (item: FlowInput) => void;
}) {
    const t = useTokens();
    return (
        <View style={{ gap: t.space.sm, paddingVertical: t.space.sm }}>
            {heading ? (
                <View style={[styles.chipsTitle, { gap: t.space.xs }]}>
                    <AppIcon name={heading.icon} size={s(12)} color={heading.tint} />
                    <Text style={[t.type.caption, styles.name, { color: heading.tint }]}>{label}</Text>
                </View>
            ) : null}
            <View style={[styles.chipRow, { gap: t.space.sm }]}>
                {items.map(item => (
                    <Pressable key={`${item.kind}-${item.id}`} onPress={() => (onToggle ? onToggle(item) : onOpen(item))}
                        onLongPress={onToggle ? () => onOpen(item) : undefined}
                        hitSlop={t.space.xs}
                        accessibilityRole={onToggle ? 'checkbox' : 'button'} accessibilityState={onToggle ? { checked: item.done } : undefined}
                        accessibilityLabel={`${label}: ${item.title}`}
                        accessibilityActions={onToggle ? [{ name: 'open', label: 'Open' }] : undefined}
                        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'open') onOpen(item); }}>
                        <MatteSurface radius={item.kind === 'task' ? t.radius.sm : t.radius.full} style={[styles.chip, { paddingHorizontal: t.space.md, paddingVertical: t.space.sm, gap: t.space.xs }]}>
                            <AppIcon name={onToggle && item.done ? 'checkmark-circle' : item.icon || (item.kind === 'task' ? 'checkbox' : 'repeat')} filled size={s(13)} color={item.color || (item.kind === 'task' ? t.color.warning : t.color.accent)} />
                            <Text numberOfLines={1} style={[t.type.bodySmall, styles.name, { color: item.done ? t.color.textSubtle : t.color.textPrimary }, onToggle && item.done && styles.struck]}>{item.title}</Text>
                        </MatteSurface>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

function RowView({ size, item, color, nextColor, nextStart, last, first, now, lived, updated, reason, onToggle, onOpen, onFocus, onPin, day, faces, shared, clock, calendar }: {
    shared: SharedState | null;
    /** On the calendar: its exact height (its length on the one scale). Short ones are drawn as a thin bar and one line. */
    calendar?: number;
    /** Up to when this day has been lived (livedUntil): what every fill reads. */
    lived: number;
    faces?: Face[];
    size: Size; item: FlowItem; color: string; nextColor?: string; nextStart?: number; last: boolean; first?: boolean; now: number | null; updated: boolean; day?: string;
    /** Why it moved, until it is opened (lib/dayMemory.ts why). */
    reason?: string;
    /** The now chip on the line: not while scrubbing, when the rows shown are only what is under the finger. */
    clock?: boolean;
    onToggle: (item: FlowInput) => void; onOpen: (item: FlowInput) => void; onFocus: (item: FlowInput) => void;
    onPin?: (item: FlowInput) => void;
}) {
    const t = useTokens();
    // The text's own height, measured: placed at once the first time, glided after.
    const [line, setLine] = useState({ height: 0, glide: false });
    // On the line, a pill is never shorter than its text: however short the thing, its pill
    // runs the whole height of its time and name, so each name sits plainly beside its own.
    // Worked out from the type (one line of time, one of name, at the phone's text size), not
    // measured: measured, every row grew after it appeared, and a new day slid into place.
    // The calendar keeps strict scale.
    const { fontScale } = useWindowDimensions();
    const textHeight = Math.ceil(((t.type.caption.lineHeight ?? 18) + Math.max(t.type[size.titleType].lineHeight ?? 22, s(22))) * fontScale + vs(2));
    const height = calendar !== undefined ? Math.max(2, calendar) : Math.max(pillHeight(size, item.end - item.start), textHeight);
    // Too short on the scale for its card: a thin bar and one line beside it. No length at all
    // (ticked ahead of its turn): a check mark at its minute, named on the right.
    const thin = calendar !== undefined && calendar < size.min;
    const mark = calendar !== undefined && calendar < 1;
    const meal = !!item.fixed;
    const live = item.state === 'now';
    const done = item.state === 'done';
    // Why it is where it is, when it moved: one plain reason. Cut short to
    // fit is the scissors beside its time, not a sentence.
    const cut = !!item.cutFrom && !done;
    const due = item.deadline && day ? dueLabel(item.deadline, day) : null;
    // A calendar event today: how long until it starts, or until it ends while on.
    const eta = item.kind === 'event' && now !== null
        ? now < item.start ? `in ${lengthLabel(item.start - now)}` : now < item.end ? `ends in ${lengthLabel(item.end - now)}` : null
        : null;
    // Why it moved, in a few words: said to VoiceOver only. Shown, it pushed the row taller and shifted the icon and text.
    const moved = done || live ? null : reason ?? null;
    // Held: set at an exact time. Habits and tasks only; meals and events are already fixed.
    const pinnable = !!onPin && (item.kind === 'habit' || item.kind === 'task') && !done;
    // How much of its time has gone: full once over (or done), a part while on, empty ahead.
    const elapsed = elapsedOf(item, lived);
    // A habit's pill is round; a task's has squarer corners.
    const corner = item.kind === 'task' ? t.radius.sm : size.pill / 2;
    // The road to or from an event (lib/eventTravel.ts): its own look.
    const travel = item.kind === 'event' && isTravel(item.id);
    // A change of length, or a line that comes or goes when it is ticked, is
    // glided by a layout transition: the new size is laid out once and the
    // native views are moved to it, rather than the page being laid out again
    // on every frame (which is what made a tick stutter).
    const pillStyle = { height };
    const bodyStyle = { minHeight: height };
    // A row's colour fades rather than switching; what is inside it is placed
    // from its top and glided to the middle (below), so nothing jumps.
    const full = elapsedOf(item, lived) >= 1;
    const pillTone = useTone(full ? color : t.color.surfaceRaised);
    // Centred, but moved there rather than laid out there: the icon and the
    // text are placed from the top and slide to the middle with the same
    // glide as the card, so they stay centred all the way through a resize.
    const cap = Math.min(size.pill, size.min);
    const iconAt = useGlideY((height - cap) / 2);
    // Until the text is measured, its height as worked out above: starting from 0 drew a new
    // row's text half a row too low for a frame, then snapped it up (a twitch on every day switch).
    const lineAt = useGlideY(Math.max(0, (height - (line.height || textHeight)) / 2), line.glide);
    // A task's subtasks, folded away until the chevron opens them.
    const [stepsOpen, setStepsOpen] = useState(false);
    // Where now falls in this row, if it does: inside its pill while it is on,
    // in the free time after it before the next one, or above the first.
    const gapHeight = nextStart !== undefined ? gapHeightOf(size, nextStart - item.end) : 0;
    // The chip is held inside the stretch it belongs to (its own pill, or the free line
    // after it), so near an edge it never slides over the pill next door or a lock badge.
    const chipHalf = NOW_CHIP / 2 + s(2);
    const within = (at: number, from: number, to: number) => to - from >= 0 ? Math.min(Math.max(at, from), to) : (from + to) / 2;
    const badgeRoom = item.locked && !meal ? size.pill * 0.36 : 0;
    const nowAt = calendar !== undefined || now === null ? null
        : now >= item.start && now < item.end ? within(((now - item.start) / Math.max(1, item.end - item.start)) * height, chipHalf, height - chipHalf - badgeRoom)
        : nextStart !== undefined && now >= item.end && now < nextStart ? within(height + ((now - item.end) / Math.max(1, nextStart - item.end)) * gapHeight, height + chipHalf, height + gapHeight - chipHalf)
        : first && now < item.start ? 0
        : null;
    if (mark) {
        return (
            <Pressable onPress={() => onOpen(item)} accessibilityRole="button" style={[styles.markRow, { top: -size.check, height: size.check * 2 }]}
                accessibilityLabel={`${item.title}, done at ${clockLabel(item.start)}`}>
                <View style={[styles.rail, { width: size.pill }]}>
                    <View style={[styles.markDot, { width: size.check * 2, height: size.check * 2, borderRadius: size.check, backgroundColor: color }]}>
                        <AppIcon name="checkmark" size={size.check} color={textOn(color)} />
                    </View>
                </View>
                <View style={[styles.markLabel, { gap: t.space.xs }]}>
                    <Text numberOfLines={1} style={[t.type.caption, styles.name, styles.struck, { color: t.color.textMuted }]}>{item.title}</Text>
                    <Text style={[t.type.caption, { color: t.color.textSubtle }]}>{clockLabel(item.start)}</Text>
                </View>
            </Pressable>
        );
    }
    if (thin) {
        return (
            <View style={[styles.row, { height }]}>
                <View style={[styles.rail, { width: size.pill }]}>
                    <Pressable onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} hitSlop={t.space.md}>
                        <View style={[styles.pill, { width: size.pill, height, borderRadius: Math.min(height / 2, corner), backgroundColor: elapsed > 0 ? color : t.color.surfaceRaised, borderWidth: 1, borderColor: color }]} />
                    </Pressable>
                </View>
                {/* One line, centred on the bar: it may run over the free time below; the bar stays true to scale. */}
                <Pressable onPress={() => onOpen(item)} style={[styles.thinLine, { top: height / 2 - size.min / 2, height: size.min, left: size.pill + size.gap, gap: t.space.sm }]}
                    accessibilityRole="button" accessibilityLabel={[item.title, whenLabel(item), live ? 'now' : null, done ? 'done' : null].filter(Boolean).join(', ')}>
                    {live ? <Text style={[t.type.caption, styles.nowTag, { color: t.color.accentText }]}>Now</Text> : null}
                    <StruckTitle title={item.title} done={done} struck={done && !meal} style={[t.type.bodySmall, styles.name, styles.thinTitle]} />
                    <Text numberOfLines={1} style={[t.type.caption, { color: t.color.textSubtle }]}>{rangeLabel(item.start, item.end)}</Text>
                    {meal && !(live || done) ? null : <Check size={size} done={done} color={color} onPress={() => onToggle(item)} label={meal ? `${item.title} finished` : item.title}
                        locked={item.kind === 'habit' && day !== localDateKey(new Date())} waiting={null} />}
                </Pressable>
            </View>
        );
    }
    return (
        <View>
        <View style={[styles.row, calendar !== undefined ? { height } : null]}>
            <View style={[styles.rail, { width: size.pill }]}>
                <Pressable onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
                    {travel ? (
                        // Getting there or back: an open, dashed pill in the event's
                        // colour, the car inside, so the road never reads as an event.
                        <Animated.View layout={LIST_LAYOUT} style={[styles.pill, styles.travelPill, { width: size.pill, borderRadius: size.pill / 2, borderColor: color, backgroundColor: t.color.background, paddingTop: (cap - size.icon) / 2 }, pillStyle]}>
                            <Animated.View style={iconAt}>
                                <AppIcon name="car" filled size={size.icon} color={color} />
                            </Animated.View>
                        </Animated.View>
                    ) : (
                    <Animated.View layout={LIST_LAYOUT} style={[styles.pill, { width: size.pill, borderRadius: corner, paddingTop: (cap - size.icon) / 2 }, pillStyle, pillTone]}>
                        {/* Still to come: the plain card surface with its icon in
                            colour; filled from the top in its own flat colour as its
                            time passes. Done keeps its full colour: only the name is struck through.
                            Full is the pill's own colour, fading in, so a pill that
                            shrinks or grows has nothing inside it to catch up. */}
                        {elapsed > 0 && elapsed < 1 ? <Fill color={color} height={height} progress={elapsed} /> : null}
                        <Animated.View style={iconAt}>
                            <AppIcon name={item.icon || (item.kind === 'task' ? 'checkbox' : 'repeat')} filled size={size.icon} color={elapsed >= 0.5 ? t.color.onAccent : color} />
                        </Animated.View>
                    </Animated.View>
                    )}
                    {/* Pinned at its time (PinSheet): a badge on the pill's bottom-right corner, cut out of
                        the page with the lock in the item's colour; held to a class or meal (lib/habitAnchor.ts), a link. */}
                    {item.locked && !meal ? (
                        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                            style={[styles.lockBadge, { width: size.pill * 0.42, height: size.pill * 0.42, borderRadius: size.pill * 0.21, right: -size.pill * 0.1, bottom: -size.pill * 0.06, backgroundColor: t.color.background }]}>
                            <AppIcon name={item.anchoredTo ? 'link' : 'lock-closed'} filled size={size.pill * 0.24} color={color} />
                        </View>
                    ) : null}
                </Pressable>
                {/* The line to the next one, in this one's colour, filling as
                    the time between them passes. */}
                {/* Free time before the next one shows as line, on the same
                    scale as the pills: an hour free is a long stretch, back to back is short. */}
                {!last && calendar === undefined ? <Link color={color} progress={linkProgress(item, nextStart, lived)}
                    gap={gapHeight} /> : null}
            </View>

            <View style={[styles.bodyColumn, { paddingLeft: size.gap, paddingBottom: size.pad }]}>
            {/* The row itself keeps its place beside the pill; the subtasks open
                under it, so opening them never moves the task. */}
            <AnimatedPressable layout={LIST_LAYOUT} onPress={() => onOpen(item)} style={[styles.body, bodyStyle]} accessibilityRole="button"
                // What the two lines leave out is still said to VoiceOver.
                accessibilityLabel={[
                    item.title, whenLabel(item), live ? 'now' : item.state === 'next' ? 'up next' : null,
                    item.part ? `part ${item.part.index} of ${item.part.of}` : null, item.anchoredTo ? item.anchoredTo.toLowerCase() : meal || item.locked ? 'at a fixed time' : null,
                    cut ? `cut short from ${lengthLabel(item.cutFrom!)} to fit the day` : null, item.repeats ? 'repeats' : null,
                    eta, due && !done ? due : null, updated && !done ? 'rescheduled' : null, moved,
                    faces?.length ? `focusing with ${namesLine(faces.map(face => face.name))}` : null,
                ].filter(Boolean).join(', ')}
                accessibilityActions={[...(live && !meal ? [{ name: 'focus', label: 'Focus' }] : []), ...(pinnable ? [{ name: 'pin', label: item.locked ? 'Change its time' : 'Pin at a time' }] : [])]}
                onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'focus') onFocus(item); if (event.nativeEvent.actionName === 'pin') onPin?.(item); }}>
                {/* Two lines, no more: what you need to know about it, then what it is. */}
                <Animated.View style={[styles.bodyLine, lineAt]}
                    onLayout={event => { const next = Math.round(event.nativeEvent.layout.height); setLine(prev => prev.height === next ? prev : { height: next, glide: prev.height > 0 }); }}>
                <View style={styles.text}>
                    <View style={[styles.meta, { gap: t.space.sm }]}>
                        {live ? <Text style={[t.type.caption, styles.nowTag, { color: t.color.accentText }]}>Now</Text> : null}
                        <Text numberOfLines={1} style={[t.type.caption, styles.metaText, { color: t.color.textSubtle }]}>
                            {rangeLabel(item.start, item.end)}
                        </Text>

                        {meal ? null : <LevelTags priority={item.priority} difficulty={item.difficulty} dim={done} />}
                        {due && !done && (due === 'Due today' || due === 'Overdue') ? (
                            <Text numberOfLines={1} style={[t.type.caption, styles.nowTag, { color: t.color.warning }]}>{due}</Text>
                        ) : null}
                    </View>
                    <View style={styles.titleRow}>
                        <StruckTitle title={item.title} done={done} struck={done && !meal} style={[t.type[size.titleType], styles.name]} />
                        {/* Friends on it, not you: it is already yours. */}
                        {shared ? <SharedFaces people={shared.people} tint={color} size={s(20)} othersOnly /> : null}
                        {item.subtasks?.length ? <SubtaskToggle steps={item.subtasks} open={stepsOpen} onToggle={() => setStepsOpen(value => !value)} color={color} /> : null}
                    </View>
                    {/* On now: no Focus button or time left here; the bar over the tab bar says both, and VoiceOver still offers Focus. */}
                </View>
                {/* A meal or event: ticked only while it is on, or once ticked, to say it finished early. */}
                {meal && !(live || (item.done && item.doneAt !== undefined)) ? null : <Check size={size} done={done} color={color} onPress={() => onToggle(item)} label={meal ? `${item.title} finished` : item.title}
                    locked={item.kind === 'habit' && day !== localDateKey(new Date())}
                    waiting={shared && waitingOnOthers(shared, !!item.done) ? waitingLabel(shared) : null} />}
                </Animated.View>
            </AnimatedPressable>
            {stepsOpen && item.subtasks?.length ? <SubtaskList taskId={item.id} steps={item.subtasks} color={color} /> : null}
            {/* Free time before the next one, named in the gap it leaves on the line. */}
            {/* Only where it has room of its own: never under the one on now (its Focus button makes it taller than its pill), nor under open subtasks. */}
            {calendar === undefined && !last && nextStart !== undefined && nextStart - item.end >= FREE_LABEL_MIN && !stepsOpen && !live && gapHeight >= t.space['3xl'] + t.space.md ? (
                <View pointerEvents="none" style={[styles.free, { top: height + Math.max(0, (gapHeight - t.space.xl) / 2), left: size.gap }]}>
                    <Text style={[t.type.caption, { color: t.color.textSubtle }]}>{`Free · ${lengthLabel(nextStart - item.end)}`}</Text>
                </View>
            ) : null}
            </View>
        </View>
        {/* The time now, over the line: outside the swipe, so the card's edge never cuts it off. */}
        {nowAt !== null && clock !== false ? <NowLine top={nowAt} rail={size.pill} color={color} /> : null}
        </View>
    );
}

/** What a row shows of its item: a tick elsewhere leaves a row whose item did not change alone. */
const ITEM_KEYS = ['id', 'kind', 'title', 'start', 'end', 'state', 'done', 'icon', 'color', 'repeats', 'fixed', 'locked', 'cutFrom', 'anchoredTo', 'deadline', 'priority', 'difficulty', 'doneAt'] as const;
const sameItem = (a: FlowItem, b: FlowItem) => ITEM_KEYS.every(key => a[key] === b[key])
    && a.part?.index === b.part?.index && a.part?.of === b.part?.of
    && JSON.stringify(a.subtasks ?? null) === JSON.stringify(b.subtasks ?? null);
type RowProps = React.ComponentProps<typeof RowView>;
/**
 * A row re-renders only when something it draws changed: its item, its
 * neighbour's colour or start (the line between them), the clock, its faces.
 * Its handlers are fixed ones from DayTimeline that always call the latest.
 */
function sameRow(a: RowProps, b: RowProps): boolean {
    return sameItem(a.item, b.item) && a.calendar === b.calendar && a.size === b.size && a.color === b.color && a.nextColor === b.nextColor
        && a.nextStart === b.nextStart && a.last === b.last && a.first === b.first && a.now === b.now && a.lived === b.lived
        && a.updated === b.updated && a.reason === b.reason && a.onPin === b.onPin && a.clock === b.clock && a.day === b.day && a.onToggle === b.onToggle && a.onOpen === b.onOpen && a.onFocus === b.onFocus
        && JSON.stringify(a.faces ?? null) === JSON.stringify(b.faces ?? null)
        && JSON.stringify(a.shared ?? null) === JSON.stringify(b.shared ?? null);
}
const Row = React.memo(RowView, sameRow);

/** The ring you tap to finish it; it pops when it fills. */
function Check({ size, done: saved, color, onPress, label, waiting, locked = false }: {
    size: Size; done: boolean; color: string; onPress: () => void; label: string;
    /** A habit on another day: habits are ticked on their day only, so a tap does nothing but say no. */
    locked?: boolean;
    /** Shared and done by you, not yet by everyone: a minus, not a tick (what VoiceOver says then). */
    waiting?: string | null;
}) {
    const t = useTokens();
    // Fills the moment it is tapped; the day is worked out again a frame later.
    const { errorFeedback } = useHaptics();
    const [done, press] = useInstantToggle(saved, onPress, locked ? errorFeedback : undefined);
    return (
        <Pressable onPress={press} hitSlop={t.space.md} style={{ marginRight: t.space.sm }} accessibilityRole="checkbox" accessibilityState={{ checked: done, disabled: locked }}
            accessibilityHint={locked ? 'Habits are ticked on their own day' : undefined}
            accessibilityLabel={done ? `${label}, ${waiting ?? 'done'}` : `Finish ${label}`}>
            <CheckPop active={done} color={color} size={size.ring}>
                <View style={[styles.check, { width: size.ring, height: size.ring, borderRadius: size.ring / 2, borderColor: color, backgroundColor: done ? color : undefined }]}>
                    {done ? <AppIcon name={waiting ? 'remove' : 'checkmark'} size={size.check} color={t.color.onAccent} /> : null}
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
/** How much of the stretch to the next one has gone, by the same lived time as the pills. */
function linkProgress(item: FlowItem, nextStart: number | undefined, lived: number): number {
    if (nextStart === undefined) return 0;
    const from = Math.min(item.end, nextStart);
    return nextStart <= from ? (lived >= nextStart ? 1 : 0) : share(lived, from, nextStart);
}

/**
 * The line between two items. It runs under both pills, so it meets them with
 * no gap; the part already lived is in this item's flat colour, and the rest
 * is the quiet track.
 */
function Link({ color, progress, gap = 0 }: { color: string; progress: number; gap?: number }) {
    const t = useTokens();
    // The line tucks s(10) under each pill, so free time adds that back to show at its true length.
    const target = gap > 0 ? gap + s(20) : vs(10);
    // The lived part as a share of the line's own height, so nothing measures it:
    // it used to read its height back on every frame of a glide (onLayout, then a
    // re-render), for every line that moved when something was ticked.
    const share = `${Math.round(Math.max(0, Math.min(1, progress)) * 1000) / 10}%` as const;
    // Lived all the way: the line's own colour, so its length can glide with nothing inside to catch up.
    const tone = useTone(progress >= 1 ? color : t.color.border);
    return (
        <Animated.View layout={LIST_LAYOUT} style={[styles.link, { minHeight: target }, tone]}>
            {progress > 0 && progress < 1 ? <View pointerEvents="none" style={[styles.linkFill, { height: share, backgroundColor: color }]} /> : null}
        </Animated.View>
    );
}

function Fill({ color, height, progress }: { color: string; height: number; progress: number }) {
    return <View pointerEvents="none" style={[styles.fill, { backgroundColor: color, height: Math.max(0, Math.min(1, progress)) * height }]} />;
}

/**
 * Now, on the rail: the time to the second in a small chip of the colour it
 * sits on, riding down the line as the day goes. Its own clock, so only it
 * redraws each second.
 */
function NowLine({ top, rail, color }: { top: number; rail: number; color: string }) {
    const [clock, setClock] = useState(() => new Date());
    // Every second; in Low Power Mode every half minute (lib/lowPower.ts).
    const lowPower = useLowPower();
    React.useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        const every = lowPower ? 30_000 : 1000;
        const align = setTimeout(() => { setClock(new Date()); timer = setInterval(() => setClock(new Date()), every); }, 1000 - (Date.now() % 1000));
        return () => { clearTimeout(align); if (timer) clearInterval(timer); };
    }, [lowPower]);
    const pad = (n: number) => String(n).padStart(2, '0');
    const text = lowPower ? `${pad(clock.getHours())}:${pad(clock.getMinutes())}` : `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;
    const chip = s(66);
    // Glides to its place with the rows (moved, not laid out again).
    const at = onPixel(top);
    const slide = useAnimatedStyle(() => ({ transform: [{ translateY: withTiming(at, GLIDE) }] }));
    return (
        <Animated.View pointerEvents="none" entering={FadeIn.duration(MOTION.duration).reduceMotion(ReduceMotion.System)}
            style={[styles.now, { top: -NOW_CHIP / 2, left: rail / 2 - chip / 2, width: chip }, slide]} accessibilityLabel={`Now, ${text.slice(0, 5)}`}>
            <View style={[styles.nowLabel, { backgroundColor: color }]}>
                <Text style={[styles.nowText, { color: textOn(color) }]}>{text}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'stretch' },
    rail: { alignItems: 'center' },
    pill: { alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden', zIndex: 1 },
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
    bodyColumn: { flex: 1, alignSelf: 'flex-start' },
    free: { position: 'absolute' },
    // The calendar: each thing at its own time, the rail and its fill under them.
    placed: { position: 'absolute', left: 0, right: 0 },
    track: { position: 'absolute', top: 0, width: s(4), borderRadius: s(2), overflow: 'hidden', zIndex: 0 },
    freeAt: { position: 'absolute' },
    thinLine: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center' },
    thinTitle: { flexShrink: 1 },
    // A check mark at the minute it was ticked: centred on its minute, named on the right.
    lockBadge: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    markRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
    markDot: { alignItems: 'center', justifyContent: 'center' },
    markLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    body: { flexDirection: 'row', alignItems: 'flex-start' },
    bodyLine: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    name: { fontFamily: FontFamily.semibold },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
    text: { flex: 1, gap: vs(2) },
    meta: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(6) },
    // Opaque (the page's own background): the lines tucked under each pill must not show through the dashes.
    travelPill: { borderWidth: s(1.5), borderStyle: 'dashed' },
    /** The time gives way first when the top line runs out of room. */
    metaText: { flexShrink: 1 },
    nowTag: { fontFamily: FontFamily.semibold },
    struck: { textDecorationLine: 'line-through' },
    // Drawn from the left edge, across the name's middle.
    edgeDot: { borderWidth: s(1.5), alignItems: 'center', justifyContent: 'center' },
    edgeText: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: vs(34) },
    chipsTitle: { flexDirection: 'row', alignItems: 'center' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: { flexDirection: 'row', alignItems: 'center', maxWidth: s(220) },
    check: { borderWidth: s(2), alignItems: 'center', justifyContent: 'center' },
    empty: { textAlign: 'center', paddingVertical: vs(24) },
});

/** Long press wins only after a still hold, leaving ordinary scrolling alone. */
function TimelineDrag({ item, onDrag, onCancel, rowKey, register, children }: {
    item: FlowInput; onDrag?: (phase: 'start' | 'move' | 'end', item: FlowInput, x: number, y: number) => void;
    onCancel?: () => void; rowKey: string; register: (key: string, view: View | null) => void; children: React.ReactNode;
}) {
    // One ref per row, kept across renders, so the row stays registered for a drop.
    const measureRef = useCallback((view: View | null) => register(rowKey, view), [register, rowKey]);
    // Built once (hooks/useHoldDrag.ts); the item is read when it fires, not copied to the UI thread.
    const gesture = useHoldDrag({
        enabled: !!onDrag && (item.kind === 'habit' || item.kind === 'task'), holdMs: HOLD_MS,
        onPhase: (phase, x, y) => { if (phase === 'cancel') onCancel?.(); else onDrag?.(phase, item, x, y); },
    });
    return <GestureDetector gesture={gesture}><View ref={measureRef} collapsable={false}>{children}</View></GestureDetector>;
}

/** Where a held habit or task lands on the line: rows measured when the drag starts, then a time for any height. */
export interface TimelineDrop {
    measure: () => Promise<void>;
    /** The minute a drop at this height means, snapped to 5; null over itself or with nothing to drop beside. */
    timeAt: (y: number, id: string) => number | null;
}

const SNAP = 5;
/**
 * A drop between two rows starts where the lower one starts; on the top half
 * of a row, at its start (it goes before it), on the bottom half at its end
 * (after it). Above everything, the first start; below, the last end. Over
 * itself, nothing moves.
 */
export function dropTime(rows: { top: number; bottom: number; item: FlowItem }[], y: number, id: string): number | null {
    const others = rows.filter(row => row.item.id !== id);
    if (!others.length) return null;
    const self = rows.find(row => row.item.id === id && y >= row.top && y <= row.bottom);
    if (self) return null;
    const snap = (minute: number) => Math.round(minute / SNAP) * SNAP;
    if (y < others[0].top) return snap(others[0].item.start);
    for (const row of others) {
        if (y > row.bottom) continue;
        if (y < row.top) return snap(row.item.start);
        return snap(y < (row.top + row.bottom) / 2 ? row.item.start : row.item.end);
    }
    return snap(others[others.length - 1].item.end);
}
