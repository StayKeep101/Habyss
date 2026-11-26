import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * A handler whose identity never changes but which always runs the latest
 * version. Rows memoised on their props (React.memo) can then skip renders
 * when only the page's handlers were re-created, without ever acting on
 * stale state: the call goes to the newest closure, not the one they saw.
 */
export function useLatestCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    const latest = useRef(fn);
    useLayoutEffect(() => { latest.current = fn; });
    return useCallback((...args: A) => latest.current(...args), []);
}
