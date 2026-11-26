/**
 * React.memo's comparison for list rows: every prop by identity, except the
 * ones named, which are compared by what they hold (a shared-state object
 * rebuilt each render, a task re-read from storage unchanged), so a row
 * re-renders only when something it shows actually changed.
 */
export function samePropsBy<P extends object>(byValue: (keyof P)[]) {
    const deep = new Set<keyof P>(byValue);
    return (a: P, b: P): boolean => {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof P)[]);
        for (const key of keys) {
            if (a[key] === b[key]) continue;
            if (!deep.has(key)) return false;
            if (JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)) return false;
        }
        return true;
    };
}
