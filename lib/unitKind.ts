/**
 * What kind of thing a unit measures.
 *
 * The measurement screen used to reason about the number alone: a target of
 * 500 got the same buttons whether it was 500 millilitres of water or 500
 * pages, so drinking a glass took six taps and reading a chapter took fifty.
 *
 * Grouping units by what they actually measure fixes that once, for every unit
 * at the same time. Volume knows a glass is 250ml. Length knows a kilometre is
 * one. Anything the app cannot recognise falls to `count`, which is the honest
 * bucket for "pages", "homeworks", "sales calls" and everything else somebody
 * will name — a plain counter they tick up to the target.
 */

export type UnitKind = 'volume' | 'length' | 'weight' | 'currency' | 'duration' | 'count';

const KINDS: Record<UnitKind, readonly string[]> = {
    volume: ['ml', 'l', 'liter', 'liters', 'litre', 'litres', 'glasses', 'glass', 'cups', 'cup', 'oz', 'floz'],
    length: ['m', 'meter', 'meters', 'metre', 'metres', 'km', 'mi', 'mile', 'miles', 'yard', 'yards', 'ft', 'feet', 'steps'],
    weight: ['kg', 'g', 'lb', 'lbs', 'pound', 'pounds', 'gram', 'grams', 'kilogram', 'kilograms'],
    currency: ['dollars', 'dollar', 'usd', 'cad', 'eur', 'euros', 'euro', 'gbp', 'pounds sterling', 'money'],
    duration: ['second', 'seconds', 'sec', 'secs', 'minute', 'minutes', 'min', 'mins', 'hour', 'hours', 'hr', 'hrs'],
    count: [],
};

/** How each kind is named where the user sees it. */
export const KIND_LABEL: Record<UnitKind, string> = {
    volume: 'Volume',
    length: 'Distance',
    weight: 'Weight',
    currency: 'Money',
    duration: 'Time',
    count: 'Count',
};

/**
 * The kind a unit belongs to.
 *
 * Unknown units are `count` on purpose. Someone tracking "sales calls" should
 * get a counter that works, not a refusal because the app has never heard of
 * their unit.
 */
export function kindOf(unit: string | undefined | null): UnitKind {
    const key = (unit ?? '').trim().toLowerCase();
    if (!key) return 'count';
    for (const [kind, members] of Object.entries(KINDS) as [UnitKind, readonly string[]][]) {
        if (members.includes(key)) return kind;
    }
    return 'count';
}

/**
 * Amounts worth putting on a button, for this unit.
 *
 * Chosen from what the unit means rather than from how big the target is: a
 * glass of water is 250ml whether you are drinking one or eight. Where the
 * unit says nothing useful, the target's size decides, which is the old
 * behaviour and the right fallback.
 */
const BY_UNIT: Record<string, number[]> = {
    ml: [100, 250, 500],
    l: [0.25, 0.5, 1], liter: [0.25, 0.5, 1], liters: [0.25, 0.5, 1], litre: [0.25, 0.5, 1], litres: [0.25, 0.5, 1],
    km: [1, 5, 10], mi: [1, 3, 5], m: [100, 500, 1000],
    kg: [0.5, 1, 5], g: [50, 100, 500], lb: [1, 5, 10],
    dollars: [5, 20, 100], euros: [5, 20, 100], gbp: [5, 20, 100],
    minutes: [5, 15, 30], hours: [1, 2], seconds: [15, 30, 60],
    pages: [5, 10, 25], words: [100, 250, 500], reps: [1, 5, 10], sets: [1, 2, 3],
};

/** Rounded, because 0.1 * 3 is 0.30000000000000004 and that lands on a button. */
const tidy = (value: number): number => Math.round(value * 1000) / 1000;

/** Falls back to the target's magnitude, which is what the app did before. */
function byMagnitude(target: number): number[] {
    const step = target < 1 ? 0.1 : 1;
    if (target <= 10) return [step, step * 2, step * 3].map(tidy);
    if (target <= 100) return [1, 5, 10];
    if (target <= 1000) return [10, 50, 100];
    return [100, 500, 1000];
}

export function quickAmountsFor(unit: string | undefined | null, target: number): number[] {
    const key = (unit ?? '').trim().toLowerCase();
    const known = BY_UNIT[key];
    if (!known) return byMagnitude(target);
    // An amount bigger than the whole target is a button nobody can use. If the
    // target is smaller than everything this unit knows — half a kilometre —
    // the unit has nothing useful to say and the target's size decides.
    const usable = known.filter(amount => amount <= target);
    return usable.length ? usable : byMagnitude(target);
}

/** One tap of "+" in this unit. */
export function stepFor(unit: string | undefined | null, target: number): number {
    return quickAmountsFor(unit, target)[0] ?? (target < 1 ? 0.1 : 1);
}

/**
 * Whether this unit is one the user made up.
 *
 * Those get a counter rather than a keypad: "three homeworks" is counted, not
 * measured, and a numeric field for it is more ceremony than the thing needs.
 */
export const isCounted = (unit: string | undefined | null): boolean => kindOf(unit) === 'count';

/** Every kind that has units, for a grouped picker. */
export const KINDS_IN_ORDER: UnitKind[] = ['count', 'duration', 'length', 'volume', 'weight', 'currency'];

/** The known units of a kind, for grouping a picker by what things measure. */
export const unitsOfKind = (kind: UnitKind): readonly string[] => KINDS[kind];
