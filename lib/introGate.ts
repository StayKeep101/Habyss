/**
 * The launch animation, as a gate for every other animation.
 *
 * Numbers counting up, bars growing and rings closing would otherwise play
 * underneath the launch screen and be over before it lifts. While the launch
 * animation runs they wait at zero, and start as the app comes into view.
 * Open unless the launch animation holds it, so tests and screens without it
 * are never stuck.
 */
let open = true;
const listeners = new Set<() => void>();

export const isIntroDone = (): boolean => open;
export function subscribeIntro(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
/** Called before the first screen renders, when the launch animation will play. */
export function holdForIntro(): void { open = false; }
/** Called as the app comes into view. */
export function releaseIntro(): void {
    if (open) return;
    open = true;
    listeners.forEach(listener => listener());
}
