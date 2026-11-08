import { flowDay, type FlowInput } from '../dayFlow';
import { guideMoments } from '../dayGuide';

const day = { wake: 540, sleep: 1380 };
const item = (id: string, start: number, minutes: number, extra: Partial<FlowInput> = {}): FlowInput =>
    ({ id, kind: 'task', title: id, start, minutes, done: false, locked: true, ...extra });

describe('guided through the day', () => {
    const flow = flowDay([
        item('jobs', 600, 60),
        { id: 'meal:lunch', kind: 'meal', title: 'Lunch', start: 720, minutes: 60, done: false, fixed: true },
        item('gym', 780, 60, { kind: 'habit' }),
    ], 590, day);
    const moments = guideMoments(flow, 590, 'Erwan Peter');

    it('says what is on now, until when, and what is next', () => {
        expect(moments.find(m => m.id.startsWith('guide:now:jobs'))).toMatchObject({ at: 600, title: 'Now: jobs', body: 'Until 11:00 AM · Next: Lunch at 12:00 PM' });
    });
    it('asks at the end whether it is done or needs more time', () => {
        expect(moments.find(m => m.kind === 'end' && m.itemId === 'jobs')).toMatchObject({ at: 660, title: "Time's up: jobs", body: 'Done, or need more time? · Next: Lunch at 12:00 PM' });
    });
    it('Echo calls lunch by name', () => {
        expect(moments.find(m => m.kind === 'meal')?.body).toMatch(/^Hey Erwan, it's lunch time/);
    });
    it('says nothing about what is done or already past', () => {
        const later = guideMoments(flowDay([item('jobs', 600, 60, { done: true })], 700, day), 700);
        expect(later).toEqual([]);
    });
});
