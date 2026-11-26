import { racersShown, type Racer } from './marksRace';

/**
 * The race for the Friends widget: the same people and lines as Community's
 * (lib/marksRace.ts racersShown), cut to fit a widget. Written whenever
 * Community loads the race (WidgetService.writeRace). Pure.
 */
export interface WidgetRacer { id: string; name: string; initials: string; marks: number; series: number[]; me: boolean; rank: number }
export interface WidgetRace { version: 1; at: string; racers: WidgetRacer[] }

const DAYS = 30;
const FRIENDS = 4;

export const initialsOf = (name: string) =>
    name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]!.toUpperCase()).join('') || '?';

export function widgetRace(racers: Racer[], at = new Date()): WidgetRace {
    const ranked = [...racers].sort((a, b) => b.marks - a.marks);
    const rank = new Map(ranked.map((racer, index) => [racer.id, index + 1]));
    const shown = racersShown(racers, FRIENDS);
    return {
        version: 1,
        at: at.toISOString(),
        racers: shown.map(racer => {
            const series = (racer.series ?? []).filter(value => Number.isFinite(value)).slice(-DAYS);
            return {
                id: racer.id, name: racer.name.split(' ')[0] || racer.name, initials: initialsOf(racer.name),
                marks: Math.round(racer.marks), me: !!racer.me, rank: rank.get(racer.id) ?? 0,
                series: (series.length ? series : [racer.marks]).map(Math.round),
            };
        }),
    };
}
