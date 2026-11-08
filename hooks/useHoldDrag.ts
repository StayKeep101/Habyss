import { useLayoutEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

type Phase = 'start' | 'move' | 'end' | 'cancel';

/**
 * A row you hold still, then drag: the habit, task and timeline rows.
 *
 * Built once per row, not on every render. A gesture made inline is a new
 * object each render, so its callbacks were sent to the UI thread again for
 * every row whenever the page re-rendered (every tick, every minute, the
 * start of every drag). And the callbacks carry only numbers: the row's
 * habit or task stays on the JavaScript side, read from a ref, instead of
 * being copied between threads on every frame of the drag.
 */
export function useHoldDrag(options: {
    enabled: boolean;
    holdMs: number;
    /** How far the finger may wander during the hold before it counts as a scroll. */
    still?: number;
    onPhase: (phase: Phase, x: number, y: number) => void;
}) {
    const latest = useRef(options.onPhase);
    useLayoutEffect(() => { latest.current = options.onPhase; });
    const { enabled, holdMs, still } = options;
    return useMemo(() => {
        const fire = (phase: Phase, x: number, y: number) => latest.current(phase, x, y);
        let pan = Gesture.Pan().enabled(enabled).activateAfterLongPress(holdMs);
        if (still !== undefined) pan = pan.failOffsetX([-still, still]).failOffsetY([-still, still]);
        return pan
            .onStart(event => { runOnJS(fire)('start', event.absoluteX, event.absoluteY); })
            .onUpdate(event => { runOnJS(fire)('move', event.absoluteX, event.absoluteY); })
            .onEnd(event => { runOnJS(fire)('end', event.absoluteX, event.absoluteY); })
            .onFinalize((_event, success) => { if (!success) runOnJS(fire)('cancel', 0, 0); });
    }, [enabled, holdMs, still]);
}
