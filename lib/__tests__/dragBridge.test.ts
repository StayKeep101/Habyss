import { getRemoveDrag, isOverOrb, setRemoveDrag, subscribeRemoveDrag } from '../dragBridge';

describe('dragBridge', () => {
    const rect = { x: 300, y: 700, width: 60, height: 60 };

    it('hits the button and a margin around it', () => {
        expect(isOverOrb(330, 730, rect)).toBe(true);
        expect(isOverOrb(290, 690, rect)).toBe(true);
        expect(isOverOrb(100, 730, rect)).toBe(false);
        expect(isOverOrb(330, 500, rect)).toBe(false);
        expect(isOverOrb(330, 730, null)).toBe(false);
    });

    it('tells listeners only when something changes, and clears hover when the drag ends', () => {
        const seen: unknown[] = [];
        const stop = subscribeRemoveDrag(next => seen.push(next));
        setRemoveDrag({ active: true });
        setRemoveDrag({ active: true });
        setRemoveDrag({ over: true });
        setRemoveDrag({ active: false });
        stop();
        expect(seen).toEqual([
            { active: true, over: false },
            { active: true, over: true },
            { active: false, over: false },
        ]);
        expect(getRemoveDrag()).toEqual({ active: false, over: false });
    });
});
