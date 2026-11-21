import type { DayCardData, DayCardLine } from './dayCard';

/**
 * A friend's day as a deck of cards (components/Community/DayDeck.tsx): one
 * card for everything done, photos first, then what something counted (Apple
 * Health, apps, focus), then the rest. Each says what it was, what was planned
 * and what it took. Pure.
 */
export interface DeckCard {
    key: string;
    title: string;
    kind?: 'habit' | 'task';
    photo?: string;
    /** "6,240 / 10,000 steps": what counted it. */
    figure?: { value: string; of?: string; unit?: string; source?: string };
    planned?: string;
    took?: string;
    /** How it went against the plan: "8 min under", "12 min over", "On plan". */
    verdict?: { text: string; tone: 'good' | 'over' | 'even' };
    /** "Done 7:42 am". */
    when?: string;
}

export const minutesLabel = (minutes: number): string => {
    const m = Math.round(minutes);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
};

const timeLabel = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
const amount = (value: number) => (Number.isInteger(value) ? value.toLocaleString('en-US') : value.toLocaleString('en-US', { maximumFractionDigits: 1 }));
const isMinutes = (unit: string) => /^(min|mins|minutes?)$/i.test(unit);

/** What it took: minutes focused on it, else minutes its apps or Health counted. */
function tookMinutes(line: DayCardLine): number | undefined {
    if (line.minutes) return line.minutes;
    if (line.tracked && isMinutes(line.tracked.unit)) return line.tracked.value;
    return undefined;
}

export function deckCard(line: DayCardLine, index: number): DeckCard {
    const took = tookMinutes(line);
    const card: DeckCard = { key: `${line.kind ?? 'x'}:${line.name}:${index}`, title: line.name, kind: line.kind, photo: line.photo };
    if (line.tracked) {
        card.figure = { value: amount(line.tracked.value), of: amount(line.tracked.target), unit: line.tracked.unit || undefined, source: line.tracked.source };
    } else if (line.minutes) {
        card.figure = { value: minutesLabel(line.minutes), source: 'focused' };
    }
    if (line.planned) card.planned = minutesLabel(line.planned);
    if (took !== undefined) card.took = minutesLabel(took);
    if (line.planned && took !== undefined) {
        const gap = Math.round(took - line.planned);
        card.verdict = Math.abs(gap) <= Math.max(2, line.planned * 0.05) ? { text: 'On plan', tone: 'even' }
            : gap < 0 ? { text: `${minutesLabel(-gap)} under`, tone: 'good' } : { text: `${minutesLabel(gap)} over`, tone: 'over' };
    }
    if (line.at) card.when = `Done ${timeLabel(line.at)}`;
    return card;
}

/** Every card in the deck, in the order it is dealt. */
export function deckCards(card: DayCardData): DeckCard[] {
    const all = [...(card.top ?? []), ...(card.habits ?? []), ...(card.tasks ?? [])].filter(line => line.done);
    const seen = new Set<string>();
    const lines = all.filter(line => { const key = `${line.kind ?? ''}|${line.name}`; if (seen.has(key)) return false; seen.add(key); return true; });
    const rank = (line: DayCardLine) => (line.photo ? 0 : line.tracked || line.minutes ? 1 : 2);
    return lines.map((line, index) => ({ line, index })).sort((a, b) => rank(a.line) - rank(b.line) || a.index - b.index)
        .map(({ line, index }) => deckCard(line, index));
}
