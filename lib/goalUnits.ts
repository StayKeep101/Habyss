import { ALLOWED_UNITS } from './goalParser';

const labels: Record<string, string> = {
    km: 'Km', m: 'Meters', mi: 'Miles', ml: 'ml', kg: 'kg', lb: 'lb',
    dollars: 'USD', euros: 'EUR', gbp: 'GBP', percent: '%',
};

export const goalUnitLabel = (unit: string) => labels[unit] ?? unit.charAt(0).toUpperCase() + unit.slice(1);
export const GOAL_UNITS = ALLOWED_UNITS.map(id => ({ id, label: goalUnitLabel(id) }));

export const UNIT_GROUPS = {
    All: ALLOWED_UNITS as readonly string[],
    Count: ['books', 'pages', 'chapters', 'words', 'sessions', 'reps', 'sets', 'laps', 'lessons', 'tasks', 'projects', 'percent'],
    Distance: ['km', 'mi', 'm', 'steps'],
    Time: ['minutes', 'hours'],
    Money: ['dollars', 'euros', 'gbp'],
    Health: ['kg', 'lb', 'ml', 'liters', 'glasses'],
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
