import { useCallback, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
    runOnJS, useAnimatedReaction, useSharedValue, withTiming,
    Easing, type SharedValue,
} from 'react-native-reanimated';
import { useHaptics } from '@/hooks/useHaptics';

/**
 * Reading a chart with your finger, the way a portfolio does it.
 *
 * Two things make the difference between this and a chart you tap.
 *
 * The first is that the crosshair lives entirely on the UI thread. Nothing here
 * calls `setState` while the finger moves — the line, the dot and the readout
 * all animate from shared values — so a drag stays at sixty frames whatever
 * JavaScript is doing. The only thing that crosses back to React is the day
 * *number*, and only when it actually changes, which is at most once per day
 * crossed rather than once per frame.
 *
 * The second is the gesture. A chart inside a scrolling page is a fight over
 * who owns the touch, and the old implementation lost it: it used React
 * Native's responder system, so the ScrollView could take the gesture away
 * mid-drag, which fires a termination, which cleared the crosshair. That is the
 * bar "resetting" while you drag. `failOffsetY` hands vertical movement to the
 * page and `activeOffsetX` keeps horizontal movement here, so neither has to
 * steal anything from the other, and `shouldCancelWhenOutside(false)` means
 * sliding above or below the chart keeps reading it.
 */

/** How the points are spread across the width. */
export type ScrubMode =
    /** Line charts: the first point sits on the left edge, the last on the right. */
    | 'points'
    /** Bar charts: each point owns a slot, and the mark is its middle. */
    | 'slots';

export interface Scrub {
    gesture: ReturnType<typeof Gesture.Pan>;
    /** Where the mark is, in points from the left edge. Snapped to a point. */
    x: SharedValue<number>;
    /** The point under the finger, or -1 when nothing is being read. */
    index: SharedValue<number>;
    /** 0 idle, 1 reading. For fading a crosshair in and out. */
    active: SharedValue<number>;
    /** Puts a sticky mark away. A no-op on a chart that clears itself. */
    clear: () => void;
}

const FADE = { duration: 120, easing: Easing.out(Easing.quad) };

/**
 * How wide one bar is, and how far it is to the next one.
 *
 * Worth doing properly rather than dividing the width by the count: the gaps
 * between thirty bars are a fifth of the chart, and ignoring them walks the
 * mark off the bar it names — by about a point at the end of a month here, and
 * by more wherever the gaps are wider or the bars fewer.
 */
function pitchOf(width: number, count: number, gap: number) {
    'worklet';
    const bar = (width - gap * Math.max(0, count - 1)) / count;
    return { bar, pitch: bar + gap };
}

/**
 * Which point a finger at `px` is reading.
 *
 * Exported and pure so the arithmetic can be checked without a device: an
 * off-by-one here is a chart that reads out the wrong day, which is worse than
 * a chart that does not scrub at all.
 */
export function indexAt(px: number, width: number, count: number, mode: ScrubMode, gap = 0): number {
    'worklet';
    if (count <= 0 || width <= 0) return -1;
    const last = count - 1;
    if (mode === 'slots') {
        const { pitch } = pitchOf(width, count, gap);
        // The gap after a bar belongs to that bar, so there is no dead space
        // between days where a finger reads nothing.
        return Math.min(last, Math.max(0, Math.floor(px / pitch)));
    }
    const ratio = Math.min(1, Math.max(0, px / width));
    return Math.round(ratio * last);
}

/** Where that point's mark belongs, so the line lands on a day and not between two. */
export function centreOf(index: number, width: number, count: number, mode: ScrubMode, gap = 0): number {
    'worklet';
    if (count <= 0) return 0;
    if (mode === 'slots') {
        const { bar, pitch } = pitchOf(width, count, gap);
        return index * pitch + bar / 2;
    }
    return count === 1 ? width / 2 : (index / (count - 1)) * width;
}

/** The closest two ticks may come, so a fast flick reads as a ripple rather than a motor. */
const TICK_GAP_MS = 28;
/** The time, read on the UI thread where the ticks are decided. */
const stamp = () => { 'worklet'; return Date.now(); };

export function useScrub({ count, width, mode = 'points', gap = 0, onIndex, onRelease, haptics = true, sticky = false, accents }: {
    count: number;
    width: number;
    mode?: ScrubMode;
    /** The space between bars, in points. Only meaningful for `slots`. */
    gap?: number;
    /** Called with the day under the finger, and with null when it lifts. */
    onIndex?: (index: number | null) => void;
    /**
     * Called with the day the finger lifted from, and only after a real drag.
     *
     * A tap never reaches this. The two are worth telling apart because a chart
     * usually sits on top of something else that wants taps — bars that open a
     * day, in this app — and a release handler that could not tell the
     * difference would undo every tap by reopening what the tap had just shut.
     */
    onRelease?: (index: number) => void;
    haptics?: boolean;
    /**
     * Whether the reading survives the finger lifting.
     *
     * A crosshair that disappears on release means the only way to read a value
     * is to keep holding it there, with your own hand over the number — so
     * letting go to look at it is exactly what clears it. On a chart whose
     * whole purpose is reading off a day, the value should stay until something
     * else is chosen. Callers that want the transient behaviour, like a
     * scrubbing bar chart, leave this off.
     */
    sticky?: boolean;
    /**
     * Points that land with a firmer tap: a trading chart's high, low and
     * latest, so the extremes can be felt as the finger passes them. With
     * these, touching down gives a soft tap too.
     */
    accents?: number[];
}): Scrub {
    const { selectionFeedback, softFeedback, rigidFeedback } = useHaptics();
    const lastTick = useSharedValue(0);
    const marked = useSharedValue<number[]>([]);
    useEffect(() => { marked.set(accents ?? []); }, [accents, marked]);
    const x = useSharedValue(0);
    const index = useSharedValue(-1);
    const active = useSharedValue(0);
    /** Whether this touch became a drag, rather than staying a tap. */
    const dragged = useSharedValue(0);

    // Reported from a reaction on the *integer*, so a flick across thirty days
    // is thirty calls rather than one per frame.
    useAnimatedReaction(
        () => index.value,
        (now, before) => {
            if (now === before) return;
            if (now >= 0 && haptics) {
                const at = stamp();
                if (marked.get().includes(now)) { lastTick.set(at); runOnJS(rigidFeedback)(); }
                else if (at - lastTick.get() >= TICK_GAP_MS) { lastTick.set(at); runOnJS(selectionFeedback)(); }
            }
            if (onIndex) runOnJS(onIndex)(now >= 0 ? now : null);
        },
        [onIndex, haptics],
    );

    const gesture = useMemo(() => {
        const read = (px: number) => {
            'worklet';
            const found = indexAt(px, width, count, mode, gap);
            if (found < 0) return;
            index.set(found);
            // Snapped, not raw: the mark belongs on the day, not between two.
            x.set(centreOf(found, width, count, mode, gap));
        };

        return Gesture.Pan()
            // Begin fires on touch down, before the gesture has won anything, so
            // the crosshair is there from the first frame. If the page turns out
            // to be scrolling instead, the finalizer takes it away again.
            .minDistance(0)
            .activeOffsetX([-6, 6])
            .failOffsetY([-14, 14])
            .shouldCancelWhenOutside(false)
            .onBegin(event => {
                'worklet';
                read(event.x);
                active.set(withTiming(1, FADE));
            })
            // Start fires on activation, which is after the finger has moved
            // far enough sideways to be a drag rather than a tap.
            .onStart(() => {
                'worklet';
                // A chart with accents answers the drag taking hold, softly, as trading apps do (never a page scroll).
                if (haptics && marked.get().length) { lastTick.set(stamp()); runOnJS(softFeedback)(); }
                dragged.set(1);
            })
            .onUpdate(event => {
                'worklet';
                read(event.x);
            })
            .onFinalize(() => {
                'worklet';
                if (dragged.get() === 1 && onRelease && index.get() >= 0) runOnJS(onRelease)(index.get());
                dragged.set(0);
                // A sticky chart keeps the mark and the reading where they were
                // left. Everything else takes both away with the finger.
                if (sticky && index.get() >= 0) return;
                active.set(withTiming(0, FADE));
                index.set(-1);
            });
    }, [count, width, mode, gap, onRelease, sticky, x, index, active, dragged, haptics, marked, lastTick, softFeedback]);

    /** Puts the mark away. For a sticky chart, whoever decides it is finished. */
    const clear = useCallback(() => {
        active.set(withTiming(0, FADE));
        index.set(-1);
    }, [active, index]);

    return { gesture, x, index, active, clear };
}
