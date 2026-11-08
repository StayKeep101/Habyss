import { clockLabel, isTravel, type DayFlow, type FlowItem } from './dayFlow';

/**
 * Guided through the day by notifications (Settings → Notifications → Guide me
 * through the day), so knowing what is on never means opening the timeline:
 *
 *   - as each habit or task begins: "Now: Apply to 50 jobs", until when, and
 *     what comes next;
 *   - when its time is up and it is not ticked: "Time's up", with Done, +10
 *     min, +30 min and Skip on the notification (lib/notificationActions.ts).
 *     The answer is also how long it really took (lib/learnedLength.ts);
 *   - as a meal begins: Echo, by name ("Hey Erwan, it's lunchtime");
 *   - before a calendar event: Leave now (its travel), or that it is soon.
 *
 * Worked out from today's timeline (lib/dayFlow.ts), so it moves when the day
 * does; NotificationService books it with everything else and replaces it on
 * every change. Pure, so it is tested without a phone.
 */
export interface GuideMoment {
    id: string;
    /** Minutes from midnight. */
    at: number;
    title: string;
    body: string;
    /** The habit or task it is about, when it is one. */
    itemId?: string;
    itemKind?: 'habit' | 'task';
    kind: 'now' | 'end' | 'meal' | 'event';
}

/** How long before an event with no travel the reminder comes. */
const EVENT_LEAD = 10;

const open = (item: FlowItem) => !item.done && item.state !== 'done';
const doable = (item: FlowItem) => (item.kind === 'habit' || item.kind === 'task') && open(item);

export function guideMoments(flow: DayFlow, now: number, name?: string | null): GuideMoment[] {
    const line = flow.timeline;
    // A split one (rule 4) is announced once, at its first part.
    const firstPart = (item: FlowItem) => !item.part || item.part.index === 1;
    const nextAfter = (index: number) => line.slice(index + 1).find(item => (doable(item) || item.kind === 'meal' || (item.kind === 'event' && !isTravel(item.id))) && item.id !== line[index].id);
    const out: GuideMoment[] = [];
    const first = name?.trim().split(/\s+/)[0];
    line.forEach((item, index) => {
        const next = nextAfter(index);
        const nextLine = next ? `Next: ${next.title} at ${clockLabel(next.start)}` : null;
        if (doable(item) && firstPart(item)) {
            if (item.start > now) {
                out.push({ id: `guide:now:${item.id}:${item.start}`, at: item.start, kind: 'now', itemId: item.id, itemKind: item.kind as 'habit' | 'task',
                    title: `Now: ${item.title}`, body: [`Until ${clockLabel(item.end)}`, nextLine].filter(Boolean).join(' · ') });
            }
        }
        // Time's up at the end of its last part: done, or more time?
        if (doable(item) && (!item.part || item.part.index === item.part.of) && item.end > now) {
            out.push({ id: `guide:end:${item.id}:${item.end}`, at: item.end, kind: 'end', itemId: item.id, itemKind: item.kind as 'habit' | 'task',
                title: `Time's up: ${item.title}`, body: ['Done, or need more time?', nextLine].filter(Boolean).join(' · ') });
        } else if (item.kind === 'meal' && open(item) && item.start > now) {
            const meal = item.title.trim().toLowerCase();
            out.push({ id: `guide:meal:${item.id}:${item.start}`, at: item.start, kind: 'meal', title: 'Echo',
                body: `${first ? `Hey ${first}, it's` : "It's"} ${meal} time. Step away for a bit.${next ? ` After it: ${next.title}.` : ''}` });
        } else if (item.kind === 'event' && open(item)) {
            if (isTravel(item.id) && /:to$/.test(item.id) && item.start > now) {
                const event = item.title.replace(/^To /, '');
                out.push({ id: `guide:leave:${item.id}:${item.start}`, at: item.start, kind: 'event',
                    title: `Leave now for ${event}`, body: `It starts at ${clockLabel(item.end)}.` });
            } else if (!isTravel(item.id) && !line.some(other => other.id === `${item.id}:to`) && item.start - EVENT_LEAD > now) {
                out.push({ id: `guide:event:${item.id}:${item.start}`, at: item.start - EVENT_LEAD, kind: 'event',
                    title: `${item.title} in ${EVENT_LEAD} min`, body: `At ${clockLabel(item.start)}.` });
            }
        }
    });
    return out.sort((a, b) => a.at - b.at);
}
