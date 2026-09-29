import { isCounted, kindOf, quickAmountsFor, stepFor, KIND_LABEL, unitsOfKind, canConvert, convert } from '../unitKind';

describe('what a unit measures', () => {
    it('knows the physical kinds apart', () => {
        expect(kindOf('ml')).toBe('volume');
        expect(kindOf('km')).toBe('length');
        expect(kindOf('kg')).toBe('weight');
        expect(kindOf('dollars')).toBe('currency');
        expect(kindOf('minutes')).toBe('duration');
    });

    it('is not fooled by case or spacing', () => {
        expect(kindOf('  KM ')).toBe('length');
        expect(kindOf('Liters')).toBe('volume');
    });

    it('puts anything it has never heard of in count, rather than refusing it', () => {
        // Somebody tracking sales calls should get a counter that works.
        expect(kindOf('homeworks')).toBe('count');
        expect(kindOf('sales calls')).toBe('count');
        expect(kindOf('pages')).toBe('count');
    });

    it('treats a missing unit as something to be counted', () => {
        expect(kindOf(undefined)).toBe('count');
        expect(kindOf('')).toBe('count');
        expect(isCounted(null)).toBe(true);
    });

    it('names every kind, so a picker never renders a blank heading', () => {
        for (const kind of ['volume', 'length', 'weight', 'currency', 'duration', 'count'] as const) {
            expect(KIND_LABEL[kind]).toBeTruthy();
        }
    });
});

describe('what goes on the buttons', () => {
    it('knows a glass of water is 250ml, whatever the target', () => {
        // The bug this fixes: 500ml of water used to offer the same buttons as
        // 500 pages, because only the number was being looked at.
        expect(quickAmountsFor('ml', 2000)).toEqual([100, 250, 500]);
        expect(quickAmountsFor('pages', 2000)).toEqual([5, 10, 25]);
    });

    it('offers a kilometre for running and a hundred metres for walking', () => {
        expect(quickAmountsFor('km', 10)).toEqual([1, 5, 10]);
        expect(quickAmountsFor('m', 2000)).toEqual([100, 500, 1000]);
    });

    it('never offers more than the whole target', () => {
        // A 300ml target has no use for a 500ml button.
        expect(quickAmountsFor('ml', 300)).toEqual([100, 250]);
    });

    it('lets the target decide when the unit has nothing small enough', () => {
        // 50ml has no use for a 100ml button, so the target's size takes over.
        expect(quickAmountsFor('ml', 50)).toEqual([1, 5, 10]);
        expect(quickAmountsFor('km', 0.5)).toEqual([0.1, 0.2, 0.3]);
    });

    it('falls back to the target’s size for a unit it does not know', () => {
        expect(quickAmountsFor('widgets', 5)).toEqual([1, 2, 3]);
        expect(quickAmountsFor('widgets', 500)).toEqual([10, 50, 100]);
        // Rounded: 0.1 * 3 is 0.30000000000000004, which would land on a button.
        expect(quickAmountsFor('widgets', 0.5)).toEqual([0.1, 0.2, 0.3]);
    });

    it('takes the smallest amount as one tap of plus', () => {
        expect(stepFor('ml', 2000)).toBe(100);
        expect(stepFor('km', 10)).toBe(1);
    });
});

describe('grouping a picker', () => {
    it('lists the units of each physical kind', () => {
        expect(unitsOfKind('volume')).toContain('ml');
        expect(unitsOfKind('weight')).toContain('kg');
    });

    it('leaves count empty, because its units are whatever people name', () => {
        expect(unitsOfKind('count')).toEqual([]);
    });
});

describe('one grouping, shared by the picker and the controls', () => {
    it('groups the picker by what units measure, not by a hand-written list', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { UNIT_GROUPS } = require('../goalUnits') as typeof import('../goalUnits');
        expect(UNIT_GROUPS.Volume).toContain('ml');
        expect(UNIT_GROUPS.Weight).toContain('kg');
        expect(UNIT_GROUPS.Money).toContain('dollars');
        expect(UNIT_GROUPS.Distance).toContain('km');
    });

    it('no longer files kilograms and millilitres under one heading', () => {
        // The old "Health" group held both; they are not the same kind of
        // thing and do not want the same buttons.
        const { UNIT_GROUPS } = require('../goalUnits') as typeof import('../goalUnits');
        expect(UNIT_GROUPS.Volume).not.toContain('kg');
        expect(UNIT_GROUPS.Weight).not.toContain('ml');
        expect(UNIT_GROUPS.Health).toBeUndefined();
    });

    it('shows no empty headings', () => {
        const { UNIT_GROUPS } = require('../goalUnits') as typeof import('../goalUnits');
        for (const [name, units] of Object.entries(UNIT_GROUPS)) {
            expect({ name, count: units.length }).toEqual({ name, count: units.length });
            expect(units.length).toBeGreaterThan(0);
        }
    });
});

describe('converting between units of the same kind', () => {
    it('converts time, which is where the damage would be worst', () => {
        // A habit of eight hours' sleep filled from a reading in minutes would
        // otherwise read as 450 and look like a triumph.
        expect(convert(450, 'minutes', 'hours')).toBe(7.5);
        expect(convert(2, 'hours', 'min')).toBe(120);
    });

    it('converts distance, including miles', () => {
        expect(convert(1, 'km', 'm')).toBe(1000);
        expect(convert(5, 'km', 'miles')).toBeCloseTo(3.107, 2);
    });

    it('knows a glass is 250ml, the same figure the quick amounts assume', () => {
        expect(convert(2000, 'ml', 'glasses')).toBe(8);
        expect(convert(1, 'l', 'ml')).toBe(1000);
    });

    it('converts mass', () => {
        expect(convert(1, 'kg', 'g')).toBe(1000);
    });

    it('returns the same number for the same unit', () => {
        expect(convert(12, 'pages', 'pages')).toBe(12);
    });

    it('refuses rather than guessing across kinds', () => {
        // Grams and millilitres both have a scale, and neither is the other.
        expect(convert(100, 'g', 'ml')).toBeNull();
        expect(canConvert('g', 'ml')).toBe(false);
    });

    it('refuses anything it has no scale for', () => {
        // A step is a count of strides, not a distance: how long one is depends
        // on whose legs they are.
        expect(convert(8000, 'steps', 'km')).toBeNull();
        expect(convert(10, 'pages', 'words')).toBeNull();
        expect(convert(5, 'usd', 'eur')).toBeNull();
    });

    it('refuses an empty unit rather than treating it as a match', () => {
        expect(convert(5, '', '')).toBeNull();
        expect(canConvert(undefined, undefined)).toBe(false);
    });
});
