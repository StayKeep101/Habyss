import { describeParsedTask, parseTaskText } from '../taskParser';

// A Wednesday, so "friday" is two days out and "monday" is five.
const TODAY = new Date(2026, 8, 23, 9, 0, 0);
const parse = (text: string) => parseTaskText(text, TODAY);

describe('reading a task from one line', () => {
    it('takes the words it understood out of the title', () => {
        const task = parse('Call the bank tomorrow at 2pm for 30 min');
        expect(task.title).toBe('Call the bank');
        expect(task.dueDate).toBe('2026-09-24');
        expect(task.dueTime).toBe('14:00');
        expect(task.estimatedMinutes).toBe(30);
    });

    it('understands the days people actually say', () => {
        expect(parse('Pay rent today').dueDate).toBe('2026-09-23');
        expect(parse('Ring mum tomorrow').dueDate).toBe('2026-09-24');
        expect(parse('Dentist in 3 days').dueDate).toBe('2026-09-26');
        expect(parse('Review in 2 weeks').dueDate).toBe('2026-10-07');
        expect(parse('Submit next week').dueDate).toBe('2026-09-30');
    });

    it('reads a weekday as the next one still to come', () => {
        // Wednesday the 23rd: Friday is the 25th, Monday the 28th.
        expect(parse('Gym friday').dueDate).toBe('2026-09-25');
        expect(parse('Standup on monday').dueDate).toBe('2026-09-28');
        // The same weekday means next week, not today.
        expect(parse('Weekly review wednesday').dueDate).toBe('2026-09-30');
    });

    it('reads a written date, and rolls to next year once it has passed', () => {
        expect(parse('Taxes on January 31').dueDate).toBe('2027-01-31');
        expect(parse('Trip 5 December').dueDate).toBe('2026-12-05');
        expect(parse('Launch 2026-11-02').dueDate).toBe('2026-11-02');
    });

    it('reads the time, and gives a lone time today', () => {
        expect(parse('Standup at 09:30').dueTime).toBe('09:30');
        expect(parse('Call at 4').dueTime).toBe('16:00');
        expect(parse('Deploy at 11am').dueTime).toBe('11:00');
        expect(parse('Dinner at noon').dueTime).toBe('12:00');
        // Given a time and no day, it is today.
        expect(parse('Standup at 09:30').dueDate).toBe('2026-09-23');
    });

    it('hears urgency without being told a number', () => {
        expect(parse('Urgent: fix the build').priority).toBe(1);
        expect(parse('Tidy the loft sometime').priority).toBe(3);
        expect(parse('Water the plants').priority).toBe(2);
    });

    it('leaves a task it cannot date alone rather than guessing', () => {
        const task = parse('Think about the redesign');
        expect(task.title).toBe('Think about the redesign');
        expect(task.dueDate).toBeUndefined();
        expect(task.matched).toEqual({ date: false, time: false, estimate: false, priority: false });
    });

    it('does not mistake a number in the task for a date or a time', () => {
        const task = parse('Read 20 pages');
        expect(task.title).toBe('Read 20 pages');
        expect(task.dueDate).toBeUndefined();
        expect(task.dueTime).toBeUndefined();
    });

    it('never returns an empty title for a sentence that was all schedule', () => {
        expect(parse('tomorrow at 5').title).toBe('');
    });
});

describe('the line under the field', () => {
    it('says today and tomorrow by name', () => {
        expect(describeParsedTask(parse('Pay rent today'), TODAY)).toBe('Today');
        expect(describeParsedTask(parse('Call the bank tomorrow at 2pm for 30 min'), TODAY))
            .toBe('Tomorrow at 14:00 · 30 min');
    });

    it('says plainly when there is no date at all', () => {
        expect(describeParsedTask(parse('Think about the redesign'), TODAY))
            .toContain('No date');
    });
});
