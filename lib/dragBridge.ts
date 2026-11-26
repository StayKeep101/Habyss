/**
 * The link between a drag on the Roadmap and the plus button in the dock.
 *
 * While something on the timeline is being dragged, the plus turns into the
 * bin: dropping the item on it asks whether to delete it. The two
 * live in different trees (the page and the tab bar), so they meet here — the
 * dock says where the button is, the page says whether a drag is on and
 * whether the finger is over it.
 */

export type Rect = { x: number; y: number; width: number; height: number };
export type RemoveDrag = { active: boolean; over: boolean; label?: string; kind?: 'delete' | 'unlink' };

let state: RemoveDrag = { active: false, over: false };
let orb: Rect | null = null;
const listeners = new Set<(next: RemoveDrag) => void>();

export function getRemoveDrag(): RemoveDrag {
    return state;
}

export function setRemoveDrag(next: Partial<RemoveDrag>): void {
    const merged = { ...state, ...next };
    if (!merged.active) merged.over = false;
    if (merged.active === state.active && merged.over === state.over && merged.label === state.label && merged.kind === state.kind) return;
    state = merged;
    listeners.forEach(listener => listener(state));
}

export function subscribeRemoveDrag(listener: (next: RemoveDrag) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** The dock reports where its round button sits on screen. */
export function setOrbRect(rect: Rect | null): void {
    orb = rect;
}

/**
 * Whether a finger at (x, y) is over the button. Generous on purpose — a
 * finger hides what it is over, so the target is the button plus a margin.
 */
export function isOverOrb(x: number, y: number, rect: Rect | null = orb, margin = 28): boolean {
    if (!rect) return false;
    return x >= rect.x - margin && x <= rect.x + rect.width + margin
        && y >= rect.y - margin && y <= rect.y + rect.height + margin;
}
