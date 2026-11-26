import { Easing, ReduceMotion } from 'react-native-reanimated';
// Shared with the Mac: packages/design/src/motion.ts. What stays here is the phone's own part.
import { DURATION } from '@habyss/design/motion';
export * from '@habyss/design/motion';

export const EASE = {
    enter: Easing.out(Easing.cubic),
    exit: Easing.in(Easing.cubic),
    move: Easing.inOut(Easing.cubic),
    /** The one landing beat of a rare moment: a single overshoot, then still. */
    land: Easing.out(Easing.back(1.4)),
} as const;

const timing = (duration: number, easing: (t: number) => number) => ({ duration, easing, reduceMotion: ReduceMotion.System });

/** Sheets, menus, filters, popup cards: one way in, one way out. */
export const OVERLAY = {
    in: timing(DURATION.base, EASE.enter),
    out: timing(DURATION.exit, EASE.exit),
} as const;

export const STAGGER = {
    /** Between rows of a list. */
    row: 35,
    /** Between the beats of a story (a title, then its line). */
    stage: 160,
} as const;

/** The goal-reached ceremony (docs/motion-system.md §4.1), in milliseconds from the trigger. */
export const CEREMONY = {
    settle: 300,
    gather: 800,
    beat: 1100,
    reveal: 1250,
    count: 1900,
} as const;

export const timingFor = timing;

/**
 * Stepping into Focus from Home (lib/focusStage.ts): one camera move in on the
 * podium, Home's page dropping away early in it, landing on the scene Focus
 * opens on. Each beat in milliseconds.
 */
export const FOCUS_ENTRY = {
    /** The camera flies in on the podium, like a drone approaching the hourglass. */
    approach: 1400,
    /** Home's page drops away, the bar rises out, the tab bar sinks (within the approach): only the scene is left. */
    leave: 520,
    /** Focus's clock and buttons appear on the scene. */
    appear: 360,
} as const;

/** Back from Focus: Home comes back into place, the hourglass turning back. */
export const FOCUS_EXIT = { return: 480 } as const;
