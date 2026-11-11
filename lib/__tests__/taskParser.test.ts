import { describeParsedTask, parseTaskText, readTaskMeasure } from '../taskParser';

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

describe('the shared phrase reader, on tasks', () => {
    const today = new Date(2026, 9, 26, 10); // Monday
    const read = (text: string) => parseTaskText(text, today);
    it('keeps day words that belong to something in the title', () => {
        expect(read("Prepare slides for Monday's meeting").title).toBe("Prepare slides for Monday's meeting");
        expect(read("Attend tomorrow's online seminar").dueDate).toBeUndefined();
        expect(read('Respond to the group chat about Saturday').title).toBe('Respond to the group chat about Saturday');
        expect(read('Buy ingredients for Sunday dinner')).toMatchObject({ title: 'Buy ingredients for Sunday dinner', dueDate: '2026-11-01' });
    });
    it('reads midnight as the end of the day and tonight as the evening', () => {
        expect(read('Submit my essay before midnight')).toMatchObject({ title: 'Submit my essay', dueDate: '2026-10-26', dueTime: '23:59' });
        expect(read('The assignment is due tonight at 11:59').dueTime).toBe('23:59');
        expect(read('Call my grandmother tonight').dueTime).toBe('19:00');
    });
    it('reads numbers in words and long estimates, and leaves names whole', () => {
        expect(read('Schedule a task that takes only one minute')).toMatchObject({ title: 'Schedule a task', estimatedMinutes: 1 });
        expect(read('Work on a task estimated to take 40 hours')).toMatchObject({ title: 'Work on a task', estimatedMinutes: 2400 });
        expect(read('Postpone an unfinished task to next week').title).toBe('Postpone an unfinished task');
        expect(read('Log in to the bank').title).toBe('Log in to the bank');
    });
    it('counts what is counted', () => {
        expect(readTaskMeasure('Review 30 new customer leads')).toEqual({ measure: 'count', target: 30, unit: 'leads' });
        expect(readTaskMeasure('Send five personalized outreach emails')).toEqual({ measure: 'count', target: 5, unit: 'emails' });
        expect(readTaskMeasure('Complete calculus homework questions 1–20')).toEqual({ measure: 'count', target: 20, unit: 'questions' });
    });
    it('takes the corrected date and the next February 29', () => {
        expect(read('Meeting on Tuesday, wait, they moved it to Thursday').dueDate).toBe('2026-10-29');
        expect(read('Finish the report by February 29').deadline).toBe('2028-02-29');
    });
    it('does not turn a thought into a priority, and keeps links as written', () => {
        expect(read("Maybe this isn't actually important")).toMatchObject({ title: "Maybe this isn't actually important", priority: 2 });
        expect(read('https://example.com/article read this later').title.startsWith('https://example.com/article')).toBe(true);
    });
});

describe('time windows and steps', () => {
    it('reads "between noon and 5 PM" as a window', () => {
        expect(parseTaskText('The package is arriving between noon and 5 PM', new Date(2026, 9, 26, 10)))
            .toMatchObject({ title: 'The package is arriving', dueTime: '12:00', estimatedMinutes: 300 });
    });
    it('keeps only well-formed steps', () => {
        const { parseSubtasks } = require('../tasks') as typeof import('../tasks');
        expect(parseSubtasks('[{"id":"a","title":"Write","done":true},{"title":""},{"id":"c","title":"Publish"}]'))
            .toEqual([{ id: 'a', title: 'Write', done: true }, { id: 'c', title: 'Publish', done: false }]);
        expect(parseSubtasks('not json')).toBeUndefined();
        expect(parseSubtasks(null)).toBeUndefined();
    });
});

describe('a time said is a time kept', () => {
    const read = (text: string) => { const { title, dueTime, flexible } = parseTaskText(text, TODAY); return { title, dueTime, flexible }; };

    it('pins a task to a clock time, in figures or in words', () => {
        expect(read('Do them dishes at four')).toEqual({ title: 'Do them dishes', dueTime: '16:00', flexible: false });
        expect(read('dishes at four thirty pm')).toEqual({ title: 'Dishes', dueTime: '16:30', flexible: false });
        expect(read("dishes at 4 o'clock")).toEqual({ title: 'Dishes', dueTime: '16:00', flexible: false });
        expect(read('dishes at 4:30')).toEqual({ title: 'Dishes', dueTime: '16:30', flexible: false });
        expect(read('dishes from 2 to 4pm').flexible).toBe(false);
    });

    it('keeps a length alone, or a rough time of day, flexible', () => {
        expect(read('dishes for 30 minutes').flexible).toBeUndefined();
        expect(read('dishes this afternoon').flexible).toBeUndefined();
        expect(read('dishes at 4 flexible').flexible).toBe(true);
    });

    it('leaves a name that only sounds like a time alone', () => {
        expect(read('dinner at Four Seasons')).toEqual({ title: 'Dinner at Four Seasons', dueTime: undefined, flexible: undefined });
    });
});

describe('a date typed in the past', () => {
    const NOV_11 = new Date(2026, 10, 11, 10);
    const day = (text: string) => parseTaskText(text, NOV_11).dueDate;

    it('lands on today when it has only just gone by', () => {
        expect(day('dishes Nov 3')).toBe('2026-11-11');
        expect(day('dishes on 3 November')).toBe('2026-11-11');
        expect(day('dishes Sep 1')).toBe('2026-11-11');
        expect(day('dishes 2026-11-03')).toBe('2026-11-11');
    });

    it('means next year when it is long gone, and stays put when still ahead', () => {
        expect(day('dishes Jan 5')).toBe('2027-01-05');
        expect(day('dishes Nov 20')).toBe('2026-11-20');
        expect(day('dishes Nov 11')).toBe('2026-11-11');
    });
});
