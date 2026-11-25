import { useState } from 'react';

/**
 * The last value that was there: `value` while it is set, and what it was
 * once it is cleared.
 *
 * A sheet opened on something (a habit to edit) closes by sliding away, and
 * it should leave showing that thing. Its opener usually clears the thing the
 * moment it asks the sheet to close, so the sheet reads it from here instead:
 * mounted with `visible={!!value}` and the last value, it slides out whole
 * rather than vanishing or turning blank.
 */
export function useLastPresent<T>(value: T | null | undefined | false): T | null {
    const [last, setLast] = useState<T | null>(value || null);
    if (value && value !== last) setLast(value);
    return value || last;
}
