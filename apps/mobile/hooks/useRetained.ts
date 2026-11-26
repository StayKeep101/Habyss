import { useRef } from 'react';

/**
 * The last value that was not null. A sheet whose content clears as it is
 * closed keeps showing that content while it slides away, instead of
 * vanishing at once (which read as a snap, not a close).
 */
export function useRetained<T>(value: T | null | undefined): T | null {
    const last = useRef<T | null>(value ?? null);
    if (value !== null && value !== undefined) last.current = value;
    return last.current;
}
