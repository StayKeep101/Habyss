import { milestoneStates, readMilestoneText, sortMilestones, splitIntoMilestones, type Milestone } from '../goalMilestones';

jest.mock('../database', () => ({ getDatabase: jest.fn(async () => null), isSQLiteAvailable: () => false, generateId: () => 'id', nowISO: () => '' }));

const m = (id: string, dueDate?: string, doneAt?: string, position = 0): Milestone => ({ id, goalId: 'g', title: id, dueDate, doneAt, position });

describe('splitting a goal into milestones', () => {
    it('makes one per book for "Read 24 books" up to December 31, at most twelve', () => {
        const steps = splitIntoMilestones({ target: 24, unit: 'books', verb: 'read', start: '2026-10-26', end: '2026-12-31' });
        expect(steps).toHaveLength(12);
        expect(steps[0].title).toBe('Read 2 books');
        expect(steps[11]).toEqual({ title: 'Read 24 books', dueDate: '2026-12-31' });
    });
    it('names each step when there are few enough: Book 1, Book 2, Book 3', () => {
        const steps = splitIntoMilestones({ target: 3, unit: 'books', verb: 'finish', start: '2026-10-26', end: '2026-11-16' });
        expect(steps.map(step => step.title)).toEqual(['Finish Book 1', 'Finish Book 2', 'Finish Book 3']);
        expect(steps.map(step => step.dueDate)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    });
    it('groups a big amount: 3000 pages in twelve steps of 250', () => {
        const steps = splitIntoMilestones({ target: 3000, unit: 'pages', start: '2026-10-26', end: '2027-03-01' });
        expect(steps[0].title).toBe('250 pages');
        expect(steps[11].title).toBe('3000 pages');
    });
    it('makes nothing without an amount or an end', () => {
        expect(splitIntoMilestones({ target: 0, start: '2026-10-26', end: '2026-12-31' })).toEqual([]);
        expect(splitIntoMilestones({ target: 5, start: '2026-10-26', end: '' })).toEqual([]);
    });
});

describe('where each milestone stands', () => {
    it('reached, late, one next, then ahead', () => {
        const list = [m('c', '2026-11-16'), m('a', '2026-11-02', '2026-11-01T10:00:00Z'), m('b', '2026-11-09'), m('late', '2026-10-20')];
        expect(sortMilestones(list).map(x => x.id)).toEqual(['late', 'a', 'b', 'c']);
        expect(milestoneStates(list, '2026-10-26')).toEqual({ late: 'late', a: 'done', b: 'next', c: 'ahead' });
    });
    it('puts undated ones last', () => {
        expect(sortMilestones([m('x'), m('y', '2026-11-01')]).map(x => x.id)).toEqual(['y', 'x']);
    });
});

describe('reading the date out of a milestone name', () => {
    const today = new Date(2026, 9, 26, 12);
    it('takes the date out of the name and sets it', () => {
        expect(readMilestoneText('Finish book 1 by October 31', today)).toEqual({ title: 'Finish book 1', dueDate: '2026-10-31' });
        expect(readMilestoneText('Beta ready by Nov 30, 2026', today)).toEqual({ title: 'Beta ready', dueDate: '2026-11-30' });
        expect(readMilestoneText('Finish book 3 on November 9', today)).toEqual({ title: 'Finish book 3', dueDate: '2026-11-09' });
        expect(readMilestoneText('MVP by 12/15', today)).toEqual({ title: 'MVP', dueDate: '2026-12-15' });
        expect(readMilestoneText('Chapter 3 in 2 weeks', today)).toEqual({ title: 'Chapter 3', dueDate: '2026-11-09' });
    });
    it('reads the end of a month, the month or the year', () => {
        expect(readMilestoneText('Design done by the end of november', today)).toEqual({ title: 'Design done', dueDate: '2026-11-30' });
        expect(readMilestoneText('Landing page by end of the month', today)).toEqual({ title: 'Landing page', dueDate: '2026-10-31' });
        expect(readMilestoneText('Launch by the end of the year', today).dueDate).toBe('2026-12-31');
    });
    it('leaves a name with no date alone', () => {
        expect(readMilestoneText('Just a name', today)).toEqual({ title: 'Just a name' });
    });
});
