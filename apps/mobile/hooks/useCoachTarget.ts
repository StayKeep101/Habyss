import { useEffect, useRef } from 'react';
import { registerTarget } from '@/lib/coachMarks';

/** Makes a view a walkthrough target (lib/coachMarks.ts): pass the ref to the view. */
export function useCoachTarget<T extends { measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void }>(id: string) {
    const ref = useRef<T | null>(null);
    useEffect(() => registerTarget(id, () => new Promise(resolve => {
        const view = ref.current;
        if (!view?.measureInWindow) { resolve(null); return; }
        view.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
    })), [id]);
    return ref;
}
