import * as Reanimated from 'react-native-reanimated';

/** A shared value, or a plain stand-in where Reanimated is mocked without it (some tests). */
const shared = (value: number) => (typeof Reanimated.makeMutable === 'function'
    ? Reanimated.makeMutable(value)
    : (() => { let current = value; return { get: () => current, set: (next: number) => { current = next; } }; })() as unknown as ReturnType<typeof Reanimated.makeMutable<number>>);

/**
 * Stepping into Focus from Home, as one movement (theme/motion.ts FOCUS_ENTRY):
 * the hourglass turns over (`turn`, 0 to 1), then Home's page drops away while
 * the bar with your picture and stats rises out and the tab bar sinks
 * (`leave`, 0 to 1), leaving only the scene; Focus opens on that same scene
 * (app/(root)/focus.tsx), its clock and buttons appearing. Coming back, Home
 * plays it the other way.
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
