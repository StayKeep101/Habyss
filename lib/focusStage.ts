import * as Reanimated from 'react-native-reanimated';

/** A shared value, or a plain stand-in where Reanimated is mocked without it (some tests). */
const shared = (value: number) => (typeof Reanimated.makeMutable === 'function'
    ? Reanimated.makeMutable(value)
    : (() => { let current = value; return { get: () => current, set: (next: number) => { current = next; } }; })() as unknown as ReturnType<typeof Reanimated.makeMutable<number>>);

/**
 * Stepping into Focus from Home, as one movement (theme/motion.ts FOCUS_ENTRY):
 * the camera flies in on the podium like a drone (`leave`, 0 to 1) while Home's
 * page drops away, its bar rises out and the tab bar sinks, early in the move;
 * it lands exactly on the frame Focus opens on (focusGlassPlace), so Focus's
 * clock and buttons simply appear on the same scene. Coming back, Home plays
 * it the other way. (`turn` is kept for callers; the glass no longer turns.)
 *
 * Home sets the stage while it is in front; from anywhere else Focus simply opens.
 */
export const focusTurn = shared(0);
export const focusLeave = shared(0);

type Stage = (go: () => void) => void;
let stage: Stage | null = null;

/** Home, while it is in front: it plays the way in, then opens Focus. */
export function setFocusStage(next: Stage | null): void { stage = next; }

/** Opens Focus, through Home's movement when Home is in front. */
export function throughStage(go: () => void): void {
    if (stage) stage(go);
    else go();
}

/**
 * Where Focus stands its hourglass, upright (app/(root)/focus.tsx pins it there, so it
 * never moves): the top of its canvas in the window, and its height. Home flies
 * the camera to exactly this frame. `top`: the safe area, the top buttons, a gap.
 */
export function focusGlassPlace(width: number, height: number, insets: { top: number; bottom: number }, bar: number, gap: number): { top: number; size: number } {
    const usable = height - insets.top - insets.bottom;
    return { top: insets.top + bar + gap, size: Math.min(width * 0.62, usable * 0.42) };
}

/** How far a dolly has come, 0 to 1, for progress `p` towards a zoom of `zoom`: steady to the eye, as a camera flying in. */
export function dolly(p: number, zoom: number): number {
    'worklet';
    if (Math.abs(zoom - 1) < 0.001) return p;
    return (Math.pow(zoom, p) - 1) / (zoom - 1);
}

/**
 * How far the camera has arrived, 0 to 1, from its progress `p`: nothing until the last
 * stretch of the approach, then all of it. What waits for the camera (the carousel over
 * the podium) appears with this, and what it replaces (Home's glass) goes with it.
 */
export function arrived(p: number): number {
    'worklet';
    return Math.max(0, Math.min(1, (p - 0.7) / 0.3));
}
