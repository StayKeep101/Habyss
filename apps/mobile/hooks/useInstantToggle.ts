import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a tick waits for the page to agree before it shows the page's answer again. */
const SETTLE_MS = 1500;

/**
 * A tick that shows the instant it is tapped.
 *
 * Ticking something makes the whole page work out the day again (the line,
 * the week strip, Marks), and the checkmark used to wait for all of that. The
 * ring now fills here, at once, and the real toggle runs a frame later, once
 * the pop has started (its animation runs on the UI thread, so the work
 * behind it no longer delays it). When the page's own answer arrives it takes
 * over. If the page never changes (a prompt asked first and was cancelled),
 * the ring goes back to what the page says. Something that cannot be ticked
 * at all passes `refuse`: the tap is answered with that alone, never a tick.
 */
export function useInstantToggle(done: boolean, toggle: () => void, refuse?: () => void): [boolean, () => void] {
    const [shown, setShown] = useState(done);
    const [was, setWas] = useState(done);
    // The page's answer changed: it wins.
    if (done !== was) { setWas(done); setShown(done); }
    const latest = useRef(done);
    useEffect(() => { latest.current = done; }, [done]);
    const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);
    const press = useCallback(() => {
        // Not something that can be ticked here (a habit on another day): it
        // never shows a tick it would only take back. `refuse` says no.
        if (refuse) { refuse(); return; }
        setShown(value => !value);
        requestAnimationFrame(() => setTimeout(toggle, 0));
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(() => { settle.current = null; setShown(latest.current); }, SETTLE_MS);
    }, [toggle, refuse]);
    return [shown, press];
}
