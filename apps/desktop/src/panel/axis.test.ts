import { describe, expect, it } from 'vitest';
import { makeAxis } from './axis';
import { countdown } from './countdown';
import { shownDate, weekOf } from './MenuPanel';

describe('the shared time axis', () => {
  it('puts one minute at the same height on both sides', () => {
    const axis = makeAxis(480, 1410);
    expect(axis.y(540)).toBe(96);
    expect(axis.height).toBe((1410 - 480) * 1.6);
    expect(axis.minuteAt(96)).toBe(540);
  });
});

describe('countdown, as the pill and the phone show it', () => {
  it('reads M:SS under an hour and H:MM:SS from one', () => {
    expect(countdown(593_000)).toBe('9:53');
    expect(countdown(3_723_000)).toBe('1:02:03');
    expect(countdown(400)).toBe('0:01');
  });
});

describe('which day the panel shows', () => {
  it('follows today, across midnight, until a day is picked', () => {
    expect(shownDate(null, new Date('2026-11-26T23:59:00'))).toBe('2026-11-26');
    expect(shownDate(null, new Date('2026-11-27T00:00:30'))).toBe('2026-11-27');
    expect(shownDate('2026-11-24', new Date('2026-11-27T00:00:30'))).toBe('2026-11-24');
  });
  it('lays the week out Monday to Sunday', () => {
    expect(weekOf('2026-11-26')).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
    expect(weekOf('2026-11-29')[0]).toBe('2026-11-23');
  });
});
