import { Easing, ReduceMotion } from 'react-native-reanimated';

/**
 * How Habyss moves: every duration, easing and beat in one place
 * (docs/motion-system.md). The more often something happens, the quieter it
 * is; nothing in the interface bounces, and only the single landing beat of a
 * rare moment overshoots. Every timing respects Reduce Motion.
 */

export const DURATION = {
    /** A press answered. */
    tap: 120,
    /** Small pieces: an icon swap, a chip. */
    quick: 180,
    /** Anything entering: a sheet, a menu, a row. */
    base: 260,
    /** Anything leaving: shorter, the user has moved on. */
    exit: 190,
    /** A value changing: a bar, a number gliding. */
    emphasis: 420,
    /** A reward revealed. */
    reward: 700,
} as const;

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
