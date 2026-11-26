import { describe, expect, it } from 'vitest';
import { panelX } from './position';

describe('panelX', () => {
  it('centres the panel under the icon', () => { expect(panelX(700, 780, 0, 1440)).toBe(310); });
  it('keeps it inside the right edge', () => { expect(panelX(1270, 780, 0, 1280)).toBe(492); });
  it('keeps it inside the left edge', () => { expect(panelX(100, 780, 0, 1280)).toBe(8); });
  it('works on a second display to the right', () => { expect(panelX(1500 + 1400, 780, 1500, 1500 + 1440)).toBe(1500 + 1440 - 8 - 780); });
});
