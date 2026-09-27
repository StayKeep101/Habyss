import { LEAD_MAX, amountLabel, leadMinutes, longLead, shortLead, splitLead } from '../leadTime';

describe('leadMinutes', () => {
    it('converts each unit to minutes', () => {
        expect(leadMinutes(30, 'minutes')).toBe(30);
        expect(leadMinutes(2, 'hours')).toBe(120);
        expect(leadMinutes(3, 'days')).toBe(4320);
    });
    it('refuses a negative or absurd lead', () => {
        expect(leadMinutes(-5, 'hours')).toBe(0);
        expect(leadMinutes(400, 'days')).toBe(LEAD_MAX);
    });
});

describe('splitLead', () => {
    it('says a duration in the largest unit that fits exactly', () => {
        expect(splitLead(120)).toEqual({ value: 2, unit: 'hours' });
        expect(splitLead(1440)).toEqual({ value: 1, unit: 'days' });
        expect(splitLead(10080)).toEqual({ value: 7, unit: 'days' });
    });
    it('keeps an awkward duration in minutes rather than rounding it', () => {
        expect(splitLead(90)).toEqual({ value: 90, unit: 'minutes' });
        expect(splitLead(1470)).toEqual({ value: 1470, unit: 'minutes' });
    });
    it('treats nothing and nonsense as on time', () => {
        expect(splitLead(0)).toEqual({ value: 0, unit: 'minutes' });
        expect(splitLead(undefined)).toEqual({ value: 0, unit: 'minutes' });
        expect(splitLead(-60)).toEqual({ value: 0, unit: 'minutes' });
    });
});

describe('describing a lead', () => {
    it('writes a sentence out in full', () => {
        expect(longLead(45)).toBe('45 minutes');
        expect(longLead(60)).toBe('1 hour');
        expect(longLead(90)).toBe('1 hour and 30 minutes');
        expect(longLead(1500)).toBe('1 day and 1 hour');
        expect(longLead(1501)).toBe('1 day, 1 hour and 1 minute');
        expect(longLead(0)).toBe('now');
    });
    it('abbreviates for a chip', () => {
        expect(shortLead(0)).toBe('On time');
        expect(shortLead(15)).toBe('15 min before');
        expect(shortLead(120)).toBe('2 hr before');
        expect(shortLead(90)).toBe('1 hr 30 min before');
        expect(shortLead(1440)).toBe('1 day before');
        expect(shortLead(2880)).toBe('2 days before');
    });
    it('names one amount button', () => {
        expect(amountLabel(5, 'minutes')).toBe('5 min');
        expect(amountLabel(6, 'hours')).toBe('6 hr');
        expect(amountLabel(1, 'days')).toBe('1 day');
        expect(amountLabel(7, 'days')).toBe('7 days');
    });
});
