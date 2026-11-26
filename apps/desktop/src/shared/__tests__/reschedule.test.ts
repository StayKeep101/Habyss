import { describe, it, expect } from 'vitest';
import { reschedulesFor } from '../reschedule';
import { endedFor } from '../endedEarly';

describe('one-day stores', () => {
    it('give their day only', () => {
        expect(reschedulesFor({ day: '2026-11-26', at: { t1: 900 } }, '2026-11-26')).toEqual({ t1: 900 });
        expect(reschedulesFor({ day: '2026-11-25', at: { t1: 900 } }, '2026-11-26')).toEqual({});
        expect(endedFor({ day: '2026-11-26', at: { 'meal:lunch': 760 } }, '2026-11-26')).toEqual({ 'meal:lunch': 760 });
        expect(endedFor({ day: '', at: {} }, '2026-11-26')).toEqual({});
    });
});
