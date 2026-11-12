import { clockLabel, isTravel, lengthLabel, type DayFlow, type FlowItem } from './dayFlow';

/**
 * The day, told as it happens (Settings → Notifications), so you never lose
 * track of time with your head down and AirPods in. Worked out from today's
 * timeline (lib/dayFlow.ts), so it moves when the day does; NotificationService
 * books it and replaces it on every change. Pure, so it is tested without a phone.
 *
 * The base, for everything on the line:
 *   - as a habit, task or event begins: just its name, "Emails" (the moment
 *     says it is now); a meal: "🥗 Lunch time"; the trip to an event:
 *     "🚶 Leave now for Class", "Starts at 2:00 PM";
 *   - when one ends just as the next begins, one notification for both:
 *     "Emails", whose button ("Last one done") ticks Study;
 *   - when one ends with free time after it: "⏰ Time's up: Study", with Done;
 *   - at bedtime: "😴 Bedtime".
 * More only when a habit or task asks for it: "Study in 10 min" (its reminders).
 * Nothing else: no check-ins, no "more time" (the next thing simply starts).
 */
export interface GuideMoment {
    id: string;
    /** Minutes from midnight. */
    at: number;
    title: string;
    body: string;
    kind: 'now' | 'handover' | 'end' | 'leave' | 'before' | 'bedtime';
    /** The habit or task this is about (opened by a tap). */
    itemId?: string;
    itemKind?: 'habit' | 'task';
    /** What the notification's Done ticks: the habit or task whose time just ended. */
    done?: { id: string; kind: 'habit' | 'task' };
}

/** A meal reads as its time of day, with something to eat on it. */
const MEAL_EMOJI: Record<string, string> = { breakfast: '🥐', lunch: '🥗', supper: '🍝' };
const mealTitle = (item: FlowItem) => `${MEAL_EMOJI[item.id.replace(/^meal:/, '')] ?? '🍽️'} ${item.title} time`;

const open = (item: FlowItem) => !item.done && item.state !== 'done';
const doable = (item: FlowItem) => (item.kind === 'habit' || item.kind === 'task') && open(item);
const firstPart = (item: FlowItem) => !item.part || item.part.index === 1;
const lastPart = (item: FlowItem) => !item.part || item.part.index === item.part.of;
/** What begins with a notification: habits, tasks, meals, events and the trip to one (not the way back). */
const announced = (item: FlowItem) => open(item) && firstPart(item)
    && (item.kind === 'habit' || item.kind === 'task' || item.kind === 'meal' || (item.kind === 'event' && (!isTravel(item.id) || /:to$/.test(item.id))));

export interface GuideOptions {
    /** Bedtime, in minutes from midnight (after midnight counts as that night). */
    sleep?: number;
    /** Each habit's or task's own reminders: minutes before it begins. */
    before?: Record<string, number[]>;
}

export function guideMoments(flow: DayFlow, now: number, options: GuideOptions = {}): GuideMoment[] {
    const line = flow.timeline;
    const out: GuideMoment[] = [];
    const starts = line.filter(item => announced(item) && item.start > now);
    const startAt = (minute: number) => starts.find(item => item.start === minute);
    const nextAfter = (minute: number) => starts.find(item => item.start >= minute);
    const ref = (item: FlowItem) => (item.kind === 'habit' || item.kind === 'task' ? { itemId: item.id, itemKind: item.kind } : null);

    // Endings first: one at the same minute as a start becomes that start's handover.
    const handovers = new Map<number, FlowItem>();
    for (const item of line) {
        if (!doable(item) || !lastPart(item) || item.end <= now) continue;
        if (startAt(item.end) && startAt(item.end)!.id !== item.id) { handovers.set(item.end, item); continue; }
        const next = nextAfter(item.end);
        out.push({ id: `guide:end:${item.id}:${item.end}`, at: item.end, kind: 'end', ...ref(item)!, done: { id: item.id, kind: item.kind as 'habit' | 'task' },
            title: `⏰ Time's up: ${item.title}`,
            body: next ? `Free until ${clockLabel(next.start)} · then ${next.title}` : 'Nothing else planned.' });
    }

    for (const item of starts) {
        const ended = handovers.get(item.start);
        if (item.kind === 'event' && isTravel(item.id)) {
            const event = item.title.replace(/^To /, '');
            out.push({ id: `guide:leave:${item.id}:${item.start}`, at: item.start, kind: 'leave',
                title: `🚶 Leave now for ${event}`, body: `Starts at ${clockLabel(item.end)}`,
                ...(ended ? { done: { id: ended.id, kind: ended.kind as 'habit' | 'task' } } : null) });
            // The heads-up asked for on the event (lib/eventTravel.ts): time to wrap up and get ready.
            const early = item.warn ? item.start - item.warn : null;
            if (early !== null && early > now) {
                out.push({ id: `guide:before:${item.id}:${item.warn}:${item.start}`, at: early, kind: 'before',
                    title: `🚶 Leave for ${event} in ${lengthLabel(item.warn!)}`, body: `Leave at ${clockLabel(item.start)} · starts at ${clockLabel(item.end)}` });
            }
            continue;
        }
        out.push({
            id: `guide:${ended ? 'handover' : 'now'}:${item.id}:${item.start}`, at: item.start, kind: ended ? 'handover' : 'now',
            ...ref(item),
            // Only its name: arriving as it starts already says "now", and the
            // Live Activity shows how long is left. Its button still ticks the last one.
            title: item.kind === 'meal' ? mealTitle(item) : item.title,
            body: '',
            ...(ended ? { done: { id: ended.id, kind: ended.kind as 'habit' | 'task' } } : null),
        });
    }

    // Its own reminders, before it begins (only what the habit or task asked for).
    for (const item of line) {
        if (!doable(item) || !firstPart(item)) continue;
        for (const minutes of [...new Set(options.before?.[item.id] ?? [])].filter(value => value > 0)) {
            const at = item.start - minutes;
            if (at <= now) continue;
            out.push({ id: `guide:before:${item.id}:${minutes}:${item.start}`, at, kind: 'before', ...ref(item)!,
                title: `⏳ ${item.title} in ${lengthLabel(minutes)}`, body: `At ${clockLabel(item.start)}` });
        }
    }

    if (options.sleep !== undefined && options.sleep > now) {
        out.push({ id: `guide:bedtime:${options.sleep}`, at: options.sleep, kind: 'bedtime', title: '😴 Bedtime', body: 'Time to wind down.' });
    }
    return out.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
