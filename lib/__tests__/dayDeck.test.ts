import { deckCard, deckCards, minutesLabel } from '../dayDeck';
import type { DayCardData } from '../dayCard';

describe('the day deck', () => {
    it('says planned against what it took', () => {
        const card = deckCard({ name: 'Read', done: true, kind: 'habit', planned: 30, tracked: { value: 42, target: 30, unit: 'min', source: 'in its apps' }, at: '21:05' }, 0);
        expect(card).toMatchObject({ title: 'Read', planned: '30 min', took: '42 min', verdict: { text: '12 min over', tone: 'over' }, when: 'Done 9:05 pm' });
        expect(deckCard({ name: 'Essay', done: true, kind: 'task', planned: 90, minutes: 75 }, 1).verdict).toEqual({ text: '15 min under', tone: 'good' });
        expect(deckCard({ name: 'Run', done: true, planned: 30, minutes: 31 }, 2).verdict?.text).toBe('On plan');
    });
    it('shows what counted it', () => {
        expect(deckCard({ name: 'Walk', done: true, tracked: { value: 6240, target: 10000, unit: 'steps', source: 'Apple Health' } }, 0).figure)
            .toEqual({ value: '6,240', of: '10,000', unit: 'steps', source: 'Apple Health' });
    });
    it('deals photos first, only what was done, once each', () => {
        const day = {
            habits: [{ name: 'Walk', done: true, kind: 'habit' }, { name: 'Gym', done: true, kind: 'habit', photo: 'p' }, { name: 'Read', done: false, kind: 'habit' }],
            tasks: [{ name: 'Essay', done: true, kind: 'task', minutes: 50 }],
            top: [{ name: 'Essay', done: true, kind: 'task', minutes: 50 }],
            habitsDone: 2, habitsTotal: 3, tasksDone: 1, tasksTotal: 1, streak: 3,
        } as DayCardData;
        expect(deckCards(day).map(card => card.title)).toEqual(['Gym', 'Essay', 'Walk']);
    });
    it('reads minutes as people say them', () => {
        expect([minutesLabel(45), minutesLabel(60), minutesLabel(95)]).toEqual(['45 min', '1 h', '1 h 35 min']);
    });
});
