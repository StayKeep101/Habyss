/** How long Habyss moves, on both apps (docs/motion-system.md). The phone eases with Reanimated, the Mac with CSS. */
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
