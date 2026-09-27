import { ALLOWED_UNITS } from './goalParser';
import { KIND_LABEL, KINDS_IN_ORDER, kindOf } from './unitKind';

const labels: Record<string, string> = {
    km: 'Km', m: 'Meters', mi: 'Miles', ml: 'ml', kg: 'kg', lb: 'lb',
    dollars: 'USD', euros: 'EUR', gbp: 'GBP', percent: '%',
};

export const goalUnitLabel = (unit: string) => labels[unit] ?? unit.charAt(0).toUpperCase() + unit.slice(1);
export const GOAL_UNITS = ALLOWED_UNITS.map(id => ({ id, label: goalUnitLabel(id) }));

/**
 * The picker's groups, derived from what each unit measures.
 *
 * They used to be a hand-written list that disagreed with the measurement
 * logic — "Health" held both kilograms and millilitres, which are not the same
 * kind of thing and do not want the same buttons. Deriving them from `kindOf`
 * means the tab you pick a unit in and the control you then get are reasoning
 * from one answer.
 *
 * A kind with no units of its own is left out rather than shown empty.
 */
export const UNIT_GROUPS: Record<string, readonly string[]> = {
    All: ALLOWED_UNITS as readonly string[],
    ...Object.fromEntries(
        KINDS_IN_ORDER
            .map(kind => [KIND_LABEL[kind], ALLOWED_UNITS.filter(unit => kindOf(unit) === kind)] as const)
            .filter(([, units]) => units.length > 0),
    ),
};

const aliases: Record<string, string> = {
    km: 'kilometers kilometres', m: 'meters metres', mi: 'miles',
    ml: 'milliliters millilitres water', liters: 'litres water',
    kg: 'kilograms weight', lb: 'pounds weight', dollars: 'money currency dollar usd $',
    euros: 'money currency euro eur €', gbp: 'money currency pounds sterling £', percent: 'percentage completion',
};

export function findGoalUnits(query: string, group: keyof typeof UNIT_GROUPS) {
    const search = query.trim().toLowerCase();
    return GOAL_UNITS.filter(unit => (search || (UNIT_GROUPS[group] as readonly string[]).includes(unit.id))
        && `${unit.id} ${unit.label} ${aliases[unit.id] ?? ''}`.toLowerCase().includes(search));
}
