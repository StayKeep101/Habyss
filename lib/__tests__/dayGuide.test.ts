import { flowDay, type FlowInput } from '../dayFlow';
import { guideMoments } from '../dayGuide';

const day = { wake: 540, sleep: 1380 };
const item = (id: string, start: number, minutes: number, extra: Partial<FlowInput> = {}): FlowInput =>
    ({ id, kind: 'task', title: id, start, minutes, done: false, locked: true, ...extra });
const lunch: FlowInput = { id: 'meal:lunch', kind: 'meal', title: 'Lunch', start: 720, minutes: 60, done: false, fixed: true };

describe('the day, told as it happens', () => {
    // 10:00 Study until 11:00, then Emails straight after; Lunch at 12:00 after a gap; Gym at 1:00 after lunch.
    const flow = flowDay([item('Study', 600, 60), item('Emails', 660, 30), lunch, item('Gym', 780, 60, { kind: 'habit' })], 590, day);
    const moments = guideMoments(flow, 590, { sleep: 1380 });
    const find = (id: string) => moments.find(moment => moment.id.startsWith(id));

    it('says when the first thing starts', () => {
        expect(find('guide:now:Study')).toMatchObject({ at: 600, kind: 'now', title: 'Study', body: '' });
        expect(find('guide:now:Study')?.done).toBeUndefined();
    });
    it('one ending as the next begins is one notification: only what starts is said, and its button ticks the one that ended', () => {
        expect(find('guide:handover:Emails')).toMatchObject({ at: 660, title: 'Emails', body: '', done: { id: 'Study', kind: 'task' } });
        expect(moments.filter(moment => moment.at === 660)).toHaveLength(1);
    });
    it("time's up with a gap after: its own notification, with Done", () => {
        expect(find('guide:end:Emails')).toMatchObject({ at: 690, title: "⏰ Time's up: Emails", body: 'Free until 12:00 PM · then Lunch', done: { id: 'Emails', kind: 'task' } });
    });
    it('meals, the trip to an event and bedtime are announced like the rest', () => {
        expect(find('guide:now:meal:lunch')).toMatchObject({ at: 720, title: '🥗 Lunch time', body: '' });
        expect(find('guide:bedtime')).toMatchObject({ at: 1380, title: '😴 Bedtime' });
        const trip = flowDay([
            { id: 'event:class', kind: 'event', title: 'Class', start: 840, minutes: 90, done: false, fixed: true },
            { id: 'event:class:to', kind: 'event', title: 'To Class', start: 820, minutes: 20, done: false, fixed: true },
            { id: 'event:class:back', kind: 'event', title: 'Back from Class', start: 930, minutes: 20, done: false, fixed: true },
        ], 600, day);
        const told = guideMoments(trip, 600);
        expect(told.find(moment => moment.kind === 'leave')).toMatchObject({ at: 820, title: '🚶 Leave now for Class', body: 'Starts at 2:00 PM' });
        expect(told.find(moment => moment.title === 'Class')?.at).toBe(840);
        expect(told.some(moment => moment.title.includes('Back from'))).toBe(false);
    });
    it('reminders before it only when it asked for them', () => {
        expect(moments.some(moment => moment.kind === 'before')).toBe(false);
        const asked = guideMoments(flow, 590, { before: { Gym: [10, 30] } }).filter(moment => moment.kind === 'before');
        expect(asked.map(moment => [moment.at, moment.title])).toEqual([[750, '⏳ Gym in 30 min'], [770, '⏳ Gym in 10 min']]);
    });
    it('says nothing about what is done or already past', () => {
        expect(guideMoments(flowDay([item('jobs', 600, 60, { done: true })], 700, day), 700)).toEqual([]);
    });
});
