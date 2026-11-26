/**
 * Doing something heavy once the screen has settled.
 *
 * `InteractionManager.runAfterInteractions` is deprecated, and React Native now
 * says to use `requestIdleCallback` — which exists on this runtime but returns
 * a plain number and has no `cancel`, so the two cannot be swapped where they
 * are called. This is the shape the app already used: something with `cancel`
 * on it, that an effect can return.
 *
 * The timeout is what makes it safe to depend on. `requestIdleCallback` is
 * allowed to never fire while a screen keeps animating, and a goal's progress
 * that never gets calculated is worse than one calculated a frame early.
 */
export interface Deferred {
    cancel: () => void;
}

const DEADLINE = 500;

export function afterPaint(work: () => void, timeout = DEADLINE): Deferred {
    if (typeof requestIdleCallback === 'function') {
        const handle = requestIdleCallback(() => work(), { timeout });
        return {
            cancel: () => {
                if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
            },
        };
    }

    // No idle callback here — a timer of zero still yields a frame first, which
    // is the whole point of deferring.
    const handle = setTimeout(work, 0);
    return { cancel: () => clearTimeout(handle) };
}
