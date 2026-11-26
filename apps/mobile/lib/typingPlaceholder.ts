/**
 * What an example placeholder shows at a moment in its loop: it types one
 * example a letter at a time, holds it, deletes it faster, and moves on to the
 * next. Pure, so the animation is just "ask again on each tick".
 */
export const TYPE_MS = 55;
export const DELETE_MS = 25;
export const HOLD_MS = 1600;
export const GAP_MS = 350;

export function placeholderAt(examples: string[], elapsed: number): string {
    if (examples.length === 0) return '';
    const cycle = (text: string) => text.length * TYPE_MS + HOLD_MS + text.length * DELETE_MS + GAP_MS;
    const total = examples.reduce((sum, text) => sum + cycle(text), 0);
    let t = ((elapsed % total) + total) % total;
    for (const text of examples) {
        const typing = text.length * TYPE_MS;
        if (t < typing) return text.slice(0, Math.floor(t / TYPE_MS) + 1);
        t -= typing;
        if (t < HOLD_MS) return text;
        t -= HOLD_MS;
        const deleting = text.length * DELETE_MS;
        if (t < deleting) return text.slice(0, text.length - Math.floor(t / DELETE_MS) - 1);
        t -= deleting;
        if (t < GAP_MS) return '';
        t -= GAP_MS;
    }
    return '';
}
