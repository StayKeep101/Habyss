import { findDate, findDeadline, findDifficulty, findTimeRange, findTiming, readDate } from '../dateWords';
import { parseTaskText } from '../taskParser';
import { parseHabitText } from '../habitParser';

// Tuesday 20 October 2026, noon.
const TODAY = new Date(2026, 9, 20, 12);
const key = (date: Date | null) => date && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('dates as people type them', () => {
    it.each([
        ['today', '2026-10-20'], ['tomorrow', '2026-10-21'], ['the day after tomorrow', '2026-10-22'],
        ['friday', '2026-10-23'], ['next tuesday', '2026-10-27'], ['in 3 weeks', '2026-11-10'], ['in two months', '2026-12-20'],
        ['dec 5', '2026-12-05'], ['5th of december', '2026-12-05'], ['12/5', '2026-12-05'], ['2026-11-02', '2026-11-02'],
        ['end of the month', '2026-10-31'], ['end of next week', '2026-11-01'], ['next week', '2026-10-27'], ['the 25th', '2026-10-25'],
        ['the 5th', '2026-11-05'], ['christmas', '2026-12-25'], ['march 3', '2027-03-03'],
    ])('reads "%s"', (phrase, expected) => {
        expect(key(readDate(phrase, TODAY))).toBe(expected);
    });

    it('finds the deadline, whichever way it is said', () => {
        for (const sentence of ['essay due by friday', 'essay due friday', 'essay by friday', 'essay before friday', 'essay, deadline friday', 'essay no later than friday']) {
            expect(findDeadline(sentence, TODAY)?.date).toBe('2026-10-23');
        }
        expect(findDeadline('call mom tomorrow', TODAY)).toBeNull();
        expect(findDate('call mom tomorrow', TODAY)?.date).toBe('2026-10-21');
    });

    it('reads difficulty only when it is said about the thing, not a word in its name', () => {
        expect(findDifficulty("essay, it's hard")?.difficulty).toBe(3);
        expect(findDifficulty('easy one: water plants')?.difficulty).toBe(1);
        expect(findDifficulty('essay hard')?.difficulty).toBe(3);
        expect(findDifficulty('fix the hard drive')).toBeNull();
        expect(findTiming('gym at 7 sharp')?.flexible).toBe(false);
        expect(findTiming('read, flexible')?.flexible).toBe(true);
        expect(findTimeRange('study from 2 to 4pm')).toMatchObject({ start: '14:00', minutes: 120 });
        expect(findTimeRange('meeting 11-1pm')).toMatchObject({ start: '11:00', minutes: 120 });
    });
});

describe('every setting from one sentence', () => {
    it('task: planned today, due Friday, hard, two hours, high priority', () => {
        const task = parseTaskText('Science project due by Friday, hard, 2 hours, urgent', TODAY);
        expect(task).toMatchObject({ title: 'Science project', dueDate: '2026-10-20', deadline: '2026-10-23', difficulty: 3, estimatedMinutes: 120, priority: 1 });
    });
    it('task: a day to do it and a deadline apart, at an exact time', () => {
        const task = parseTaskText('Write slides tomorrow at 3pm sharp due by next tuesday', TODAY);
        expect(task).toMatchObject({ title: 'Write slides', dueDate: '2026-10-21', dueTime: '15:00', deadline: '2026-10-27', flexible: false });
    });
    it('task: a time range', () => {
        expect(parseTaskText('Study from 2 to 4pm', TODAY)).toMatchObject({ title: 'Study', dueTime: '14:00', estimatedMinutes: 120 });
    });
    it('habit: until a date, its days kept, priority and difficulty', () => {
        const habit = parseHabitText('Run Monday and Wednesday at 7am sharp until Dec 1, hard, high priority', TODAY);
        expect(habit).toMatchObject({ name: 'Run', taskDays: ['mon', 'wed'], startTime: '07:00', endDate: '2026-12-01', difficulty: 3, priority: 1, flexible: false });
    });
    it('habit: for a number of weeks, and a time range', () => {
        const habit = parseHabitText('Meditate every day from 7 to 7:20am for 3 weeks', TODAY);
        expect(habit).toMatchObject({ startTime: '07:00', durationMinutes: 20, endDate: '2026-11-09' });
    });
});

describe('urgency and difficulty, in words', () => {
    const { findPriority, findDifficulty } = require('../dateWords');
    it('reads how urgent it is, and "not urgent" as not urgent', () => {
        expect(findPriority('essay, urgent')?.priority).toBe(1);
        expect(findPriority('call mum, not urgent')?.priority).toBe(3);
        expect(findPriority('tidy desk, not that important')?.priority).toBe(3);
        expect(findPriority('report high urgency')?.priority).toBe(1);
        expect(findPriority('read urgency: low')?.priority).toBe(3);
        expect(findPriority('plan the week, normal priority')?.priority).toBe(2);
    });
    it('reads how hard it is', () => {
        expect(findDifficulty('essay, hard')?.difficulty).toBe(3);
        expect(findDifficulty('walk, difficulty: low')?.difficulty).toBe(1);
        expect(findDifficulty('a tough one')?.difficulty).toBe(3);
    });
});
