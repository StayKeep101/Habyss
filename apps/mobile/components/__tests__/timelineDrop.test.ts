import { dropTime } from '../Roadmap/DayTimeline';
import type { FlowItem } from '@/lib/dayFlow';

const row = (id: string, start: number, end: number, top: number) =>
    ({ top, bottom: top + 60, item: { id, start, end } as FlowItem });
// Three rows on screen: a 9:00, b 10:00, c 11:00, each 60 pt tall.
const rows = [row('a', 540, 600, 100), row('b', 600, 660, 170), row('c', 660, 720, 240)];

describe('dropping a habit or task on the timeline', () => {
    it('on the top half of a row, it goes before it; on the bottom half, after it', () => {
        expect(dropTime(rows, 180, 'c')).toBe(600);
        expect(dropTime(rows, 225, 'c')).toBe(660);
    });
    it('between rows, at the start of the lower one; above or below everything, at the ends', () => {
        expect(dropTime(rows, 165, 'c')).toBe(600);
        expect(dropTime(rows, 20, 'b')).toBe(540);
        expect(dropTime(rows, 900, 'a')).toBe(720);
    });
    it('over itself, nothing moves', () => {
        expect(dropTime(rows, 190, 'b')).toBeNull();
    });
    it('snaps to five minutes', () => {
        expect(dropTime([row('a', 542, 603, 100), row('x', 0, 0, 500)], 110, 'x')).toBe(540);
    });
});
