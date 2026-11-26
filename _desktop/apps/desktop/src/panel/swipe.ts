import { useRef, type WheelEvent } from 'react';

export type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * A two-finger trackpad swipe, the Mac's version of the phone's swipe: one direction per gesture, decided once the fingers
 * have travelled `distance` px mostly one way, then nothing more until they stop (the gesture's momentum included).
 * `left` means the fingers moved left (the next page comes in from the right), `down` that they moved down; both as
 * the content follows the fingers with natural scrolling, which is how a Mac trackpad feels.
 * Return false from `on` to let the wheel through (a direction with nothing to do, so a list can still scroll).
 */
export function decide(dx: number, dy: number, distance = 60): Direction | null {
  if (Math.abs(dx) >= distance && Math.abs(dx) > Math.abs(dy) * 1.5) return dx > 0 ? 'left' : 'right';
  if (Math.abs(dy) >= distance && Math.abs(dy) > Math.abs(dx) * 1.5) return dy > 0 ? 'up' : 'down';
  return null;
}

export function useSwipe(on: (direction: Direction) => boolean | void, axes: 'x' | 'y' | 'both' = 'both') {
  const sum = useRef({ dx: 0, dy: 0, spent: false });
  const quiet = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (e: WheelEvent) => {
    const g = sum.current;
    clearTimeout(quiet.current);
    quiet.current = setTimeout(() => { sum.current = { dx: 0, dy: 0, spent: false }; }, 180);
    if (g.spent) { if (axes !== 'y' && Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault(); return; }
    g.dx += axes === 'y' ? 0 : e.deltaX;
    g.dy += axes === 'x' ? 0 : e.deltaY;
    const d = decide(g.dx, g.dy);
    if (d && on(d) !== false) g.spent = true;
  };
}
