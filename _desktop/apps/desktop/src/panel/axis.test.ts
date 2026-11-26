import { describe, expect, it } from 'vitest';
import { makeAxis, stack } from './axis';
import { decide } from './swipe';
import { monthDays, shiftDay, shiftMonth } from './WeekRow';
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

describe('the axis past midnight and around what happened', () => {
  it('reads a bedtime before waking as after midnight', () => {
    const axis = makeAxis(420, 60);
    expect(axis.from).toBe(420);
    expect(axis.to).toBe(1500);
  });
  it('widens to take in time tracked before waking or after bedtime', () => {
    const axis = makeAxis(480, 1380, 1.6, [{ start: 360, end: 400 }, { start: 1400, end: 1430 }]);
    expect(axis.from).toBe(360);
    expect(axis.to).toBe(1430);
  });
  it('stacks short items back to back so none sits on another', () => {
    const axis = makeAxis(480, 1380);
    const rows = stack([{ start: 600, end: 615 }, { start: 615, end: 630 }, { start: 615, end: 625 }], axis, 44, 4);
    for (let i = 1; i < rows.length; i++) expect(rows[i].top).toBeGreaterThanOrEqual(rows[i - 1].top + rows[i - 1].height + 4);
    expect(rows[0].top).toBe(axis.y(600));
  });
});

describe('two-finger swipes', () => {
  it('decides one direction, mostly one way, past a distance', () => {
    expect(decide(80, 5)).toBe('left');
    expect(decide(-80, 5)).toBe('right');
    expect(decide(5, -80)).toBe('down');
    expect(decide(5, 80)).toBe('up');
    expect(decide(40, 0)).toBeNull();
    expect(decide(70, 60)).toBeNull();
  });
});

describe('the month', () => {
  it('is whole weeks, Monday first, around the shown day', () => {
    const days = monthDays('2026-11-26');
    expect(days[0]).toBe('2026-10-26');
    expect(days.length % 7).toBe(0);
    expect(days).toContain('2026-11-30');
  });
  it('moves by a month inside the month it lands in', () => {
    expect(shiftMonth('2027-01-31', 1)).toBe('2027-02-28');
    expect(shiftDay('2026-11-26', 7)).toBe('2026-12-03');
  });
});
