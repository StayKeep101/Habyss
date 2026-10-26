import { ALLOWED_UNITS, parseGoalText, type HabitRef } from '../goalParser';

const TODAY = new Date(2026, 8, 16); // 2026-09-16
const parse = (input: string, habits: HabitRef[] = []) => parseGoalText(input, { today: TODAY, habits });

describe('the four examples from the contract', () => {
    it('run 50km this month', () => {
        const result = parse('run 50km this month', [{ id: 'h_1', name: 'Morning run', unit: 'km' }]);
        expect(result.status).toBe('complete');
        expect(result.goal).toMatchObject({
            type: 'volume', metric_unit: 'km', aggregation: 'sum', direction: 'at_least',
            target: 50, baseline: null,
            window: { kind: 'fixed', start: '2026-09-16', end: '2026-09-30' },
            linked_habits: ['h_1'], suggested_habit: null,
        });
        expect(result.goal.title).toContain('50 km');
        expect(result.goal.title).not.toContain('September');
        expect(result.missing_fields).toEqual([]);
        expect(result.clarifying_question).toBeNull();
    });

    it('no more than 1 hour on tiktok a day', () => {
        const result = parse('no more than 1 hour on tiktok a day');
        expect(result.status).toBe('complete');
        expect(result.goal).toMatchObject({
            type: 'limit', metric_unit: 'minutes', aggregation: 'sum', direction: 'at_most',
            target: 60, window: { kind: 'recurring', period: 'day' }, linked_habits: [],
        });
        expect(result.goal.suggested_habit).toMatchObject({ unit: 'minutes' });
        expect(result.goal.suggested_habit!.name.toLowerCase()).toContain('tiktok');
        expect(result.goal.title).toContain('Max 60 minutes');
    });

    it('get down to 75kg by christmas needs a baseline', () => {
        const result = parse('I want to get down to 75kg by christmas');
        expect(result.status).toBe('needs_clarification');
        expect(result.goal).toMatchObject({
            type: 'target_value', metric_unit: 'kg', aggregation: 'latest', direction: 'reach',
            target: 75, baseline: null,
            window: { kind: 'fixed', start: '2026-09-16', end: '2026-12-25' },
        });
        expect(result.missing_fields).toEqual(['baseline']);
        expect(result.clarifying_question).toContain('current');
        expect(result.clarifying_question).toContain('75');
    });

    it('read more is too vague to save', () => {
        const result = parse('read more');
        expect(result.status).toBe('needs_clarification');
        expect(result.goal.target).toBeNull();
        expect(result.goal.metric_unit).toBeNull();
        expect(result.goal.window).toBeNull();
        expect(result.missing_fields).toEqual(expect.arrayContaining(['target', 'metric_unit', 'window']));
        // The question offers concrete options rather than asking again vaguely.
        expect(result.clarifying_question).toMatch(/pages|minutes|sessions/);
    });
});

describe('goal types', () => {
    it('reads a frequency goal', () => {
        const result = parse('gym 3x a week');
        expect(result.goal).toMatchObject({
            type: 'frequency', aggregation: 'count_days', metric_unit: 'sessions',
            direction: 'at_least', target: 3, window: { kind: 'recurring', period: 'week' },
        });
        expect(result.status).toBe('complete');
    });

    it('reads "3 times a week" the same way', () => {
        expect(parse('meditate 3 times a week').goal).toMatchObject({ type: 'frequency', target: 3 });
    });

    it('reads a consistency goal as a decimal rate', () => {
        const result = parse('meditate 80% of days this month');
        expect(result.goal).toMatchObject({
            type: 'consistency', aggregation: 'completion_rate', metric_unit: 'percent', target: 0.8,
        });
        expect(result.goal.target).toBeLessThanOrEqual(1);
    });

    it('reads a limit goal', () => {
        expect(parse('less than 30 minutes of instagram a day').goal)
            .toMatchObject({ type: 'limit', direction: 'at_most', target: 30, metric_unit: 'minutes' });
    });

    it('reads a volume goal with a deadline in days', () => {
        const result = parse('write 5000 words in 30 days');
        expect(result.goal).toMatchObject({
            type: 'volume', target: 5000, metric_unit: 'words',
            window: { kind: 'fixed', start: '2026-09-16', end: '2026-10-16' },
        });
    });
});

describe('units', () => {
    it('converts hours to minutes', () => {
        expect(parse('read 2 hours a day').goal).toMatchObject({ metric_unit: 'minutes', target: 120 });
    });

    it('normalises spoken units onto the allowed list', () => {
        expect(parse('walk 10000 steps a day').goal.metric_unit).toBe('steps');
        expect(parse('drink 8 glasses of water a day').goal.metric_unit).toBe('glasses');
        expect(parse('run 5 miles a week').goal.metric_unit).toBe('mi');
    });

    it('only ever emits an allowed unit', () => {
        for (const input of ['read 50 pages a day', 'run 5km a week', 'save 100 dollars a month', 'gym 3x a week']) {
            const unit = parse(input).goal.metric_unit;
            expect(unit === null || (ALLOWED_UNITS as readonly string[]).includes(unit)).toBe(true);
        }
    });
});

describe('windows', () => {
    it('resolves recurring periods', () => {
        expect(parse('read 10 pages a day').goal.window).toEqual({ kind: 'recurring', period: 'day' });
        expect(parse('gym 3x per week').goal.window).toEqual({ kind: 'recurring', period: 'week' });
        expect(parse('save 200 dollars monthly').goal.window).toEqual({ kind: 'recurring', period: 'month' });
    });

    it('ends "this month" on the last day of the month', () => {
        expect(parse('run 50 km this month').goal.window).toEqual({ kind: 'fixed', start: '2026-09-16', end: '2026-09-30' });
    });

    it('starts from today unless told otherwise', () => {
        const window = parse('run 50 km this month').goal.window as { start: string };
        expect(window.start).toBe('2026-09-16');
    });

    it('rolls a past month into next year', () => {
        const window = parse('run 100 km by march').goal.window as { end: string };
        expect(window.end.startsWith('2027-03')).toBe(true);
    });
});

describe('habit linking', () => {
    const habits: HabitRef[] = [
        { id: 'h_run', name: 'Morning run', unit: 'km' },
        { id: 'h_read', name: 'Read before bed', unit: 'pages' },
        { id: 'h_med', name: 'Meditate', unit: 'minutes' },
    ];

    it('matches by meaning rather than exact wording', () => {
        expect(parse('run 50km this month', habits).goal.linked_habits).toEqual(['h_run']);
        expect(parse('read 300 pages this month', habits).goal.linked_habits).toEqual(['h_read']);
    });

    it('refuses a habit whose unit cannot measure the goal', () => {
        // Reading is tracked in pages, so a minutes goal must not link to it.
        expect(parse('read 60 minutes a day', habits).goal.linked_habits).toEqual([]);
    });

    it('suggests a new habit when nothing matches', () => {
        const result = parse('swim 2 km a week', habits);
        expect(result.goal.linked_habits).toEqual([]);
        expect(result.goal.suggested_habit).toMatchObject({ unit: 'km' });
        expect(result.goal.suggested_habit!.name.toLowerCase()).toContain('swim');
    });
});

describe('clarification', () => {
    it('asks at most one question', () => {
        const result = parse('get fit');
        expect(result.clarifying_question).toBeTruthy();
        expect(result.clarifying_question!.split('?').filter(Boolean).length).toBeLessThanOrEqual(2);
    });

    it('never invents a target the user did not state', () => {
        for (const vague of ['get fit', 'read more', 'be healthier', 'exercise more']) {
            expect(parse(vague).goal.target).toBeNull();
        }
    });

    it('asks for a period when only an amount is given', () => {
        const result = parse('read 300 pages');
        expect(result.status).toBe('needs_clarification');
        expect(result.missing_fields).toContain('window');
        expect(result.clarifying_question).toMatch(/period|day|week|month/i);
    });

    it('handles empty input without throwing', () => {
        const result = parse('');
        expect(result.status).toBe('needs_clarification');
        expect(() => parse('   ')).not.toThrow();
    });
});

describe('output shape', () => {
    it('always returns every field in the contract', () => {
        for (const input of ['run 50km this month', 'read more', '']) {
            const result = parse(input);
            expect(Object.keys(result).sort()).toEqual(['clarifying_question', 'goal', 'missing_fields', 'status']);
            expect(Object.keys(result.goal).sort()).toEqual([
                'aggregation', 'baseline', 'delta_from_baseline', 'direction', 'linked_habits',
                'metric_unit', 'suggested_habit', 'target', 'title', 'type', 'window',
            ]);
        }
    });

    it('is a complete goal only when target, unit and window are all present', () => {
        const result = parse('run 50km this month');
        expect(result.status).toBe('complete');
        expect(result.goal.target).not.toBeNull();
        expect(result.goal.metric_unit).not.toBeNull();
        expect(result.goal.window).not.toBeNull();
    });
});

describe('shorthand amounts and relative periods', () => {
    it('reads "10k dollars" as ten thousand, not ten', () => {
        const result = parse('Make 10k dollars next month');
        expect(result.goal.target).toBe(10000);
        expect(result.goal.metric_unit).toBe('dollars');
    });

    it('understands "next month"', () => {
        const window = parse('Make 10k dollars next month').goal.window as { start: string; end: string };
        expect(window).toEqual({ kind: 'fixed', start: '2026-10-01', end: '2026-10-31' });
    });

    it('understands "next week" and "next year"', () => {
        const week = parse('Read 100 pages next week').goal.window as { kind: string; start: string; end: string };
        expect(week.kind).toBe('fixed');
        expect(new Date(`${week.end}T12:00:00`) > new Date(`${week.start}T12:00:00`)).toBe(true);

        const year = parse('Save 20k dollars next year').goal.window as { start: string; end: string };
        expect(year).toEqual({ kind: 'fixed', start: '2027-01-01', end: '2027-12-31' });
    });

    it('completes the goal rather than asking for a period', () => {
        const result = parse('Make 10k dollars next month');
        expect(result.status).toBe('complete');
        expect(result.clarifying_question).toBeNull();
    });

    it('still reads a 5k run as five kilometres', () => {
        const result = parse('Run a 5k this month');
        expect(result.goal.target).toBe(5);
        expect(result.goal.metric_unit).toBe('km');
    });

    it('builds a title without repeating the amount back as nonsense', () => {
        const title = parse('Make 10k dollars next month').goal.title;
        expect(title).not.toMatch(/next 10 dollars/i);
        expect(title).toContain('10000 dollars');
        expect(title.toLowerCase()).not.toContain('next month');
    });

    it('keeps the subject clean in the title', () => {
        expect(parse('Save 3000 dollars this month').goal.title).toMatch(/^Save 3000 dollars/);
    });
});


describe('losing an amount is a change, not a destination', () => {
    it('keeps the amount as a delta rather than claiming it is the goal weight', () => {
        const result = parse('Lose 5kg by christmas');
        expect(result.goal.delta_from_baseline).toBe(5);
        // 5 kg is how far to move, not where to land, so the target waits for a baseline.
        expect(result.goal.target).toBeNull();
        expect(result.goal.type).toBe('target_value');
    });

    it('says lose in the title rather than reach', () => {
        const title = parse('Lose 5kg by christmas').goal.title;
        expect(title).toContain('Lose 5 kg');
        expect(title).not.toContain('Reach');
    });

    it('asks for the current weight and says what it will do with it', () => {
        const result = parse('Lose 5kg by christmas');
        expect(result.missing_fields).toContain('baseline');
        expect(result.clarifying_question).toContain('current');
        expect(result.clarifying_question).toContain('5 kg below');
    });

    it('still reads a destination weight as a destination', () => {
        const result = parse('Get down to 75kg by christmas');
        expect(result.goal.target).toBe(75);
        expect(result.goal.delta_from_baseline).toBeNull();
        expect(result.goal.title).toContain('Reach 75 kg');
    });
});

describe('dates with a year or an ISO date', () => {
    const today = new Date('2026-09-19T12:00:00');

    it('keeps the date out of the title and the amount', () => {
        const result = parseGoalText('Save 10000 dollars by December 31, 2026', { today });
        expect(result.goal.target).toBe(10000);
        expect(result.goal.title).toBe('Save 10000 dollars');
        expect(result.goal.window).toEqual({ kind: 'fixed', start: '2026-09-19', end: '2026-12-31' });
        expect(result.goal.window).toEqual({ kind: 'fixed', start: '2026-09-19', end: '2026-12-31' });
    });

    it('never takes the day of the month as the target', () => {
        const result = parseGoalText('Launch my app by January 1, 2027', { today });
        expect(result.goal.target).toBeNull();
        expect(result.goal.window).toEqual({ kind: 'fixed', start: '2026-09-19', end: '2027-01-01' });
    });

    it('keeps a deadline in another year out of the title too, as the goal\'s end date', () => {
        const result = parseGoalText('Read 3000 pages by March 1, 2027', { today });
        expect(result.goal.title).toBe('Read 3000 pages');
        expect(result.goal.window).toEqual({ kind: 'fixed', start: '2026-09-19', end: '2027-03-01' });
    });

    it('reads ISO dates and ordinals', () => {
        expect(parseGoalText('Run 200 km by 2026-11-30', { today }).goal.window).toEqual({ kind: 'fixed', start: '2026-09-19', end: '2026-11-30' });
        expect(parseGoalText('Run 200 km by November 30th', { today }).goal.window).toEqual({ kind: 'fixed', start: '2026-09-19', end: '2026-11-30' });
    });

    it('reads a month and year without a day as the end of that month', () => {
        expect(parseGoalText('Save 5000 dollars by March 2027', { today }).goal.window).toEqual({ kind: 'fixed', start: '2026-09-19', end: '2027-03-31' });
    });
});


describe('goal unit vocabulary', () => {
    it.each([
        ['Read 12 books this year', 'books', 12],
        ['Write 3 chapters this month', 'chapters', 3],
        ['Swim 500 m every week', 'm', 500],
        ['Drink 250 ml every day', 'ml', 250],
        ['Save 1000 USD this year', 'dollars', 1000],
        ['Save 500 euros this month', 'euros', 500],
    ])('understands %s', (text, unit, target) => {
        const result = parseGoalText(text as string, { today: new Date(2026, 8, 25) });
        expect(result.status).toBe('complete');
        expect(result.goal).toMatchObject({ metric_unit: unit, target });
    });
});

describe('a clean title: the deadline is a setting, never part of the name', () => {
    const today = new Date(2026, 9, 26);
    it('reads "by this year" as December 31 and leaves "Read 24 books"', () => {
        const result = parseGoalText('read 24 books by this year', { today });
        expect(result.goal.title).toBe('Read 24 books');
        expect(result.goal.target).toBe(24);
        expect(result.goal.window).toEqual({ kind: 'fixed', start: '2026-10-26', end: '2026-12-31' });
    });
    it('reads "by January 1, 2027" as the end date', () => {
        const result = parseGoalText('launch habyss by january 1, 2027', { today });
        expect(result.goal.title).toBe('Launch habyss');
        expect(result.goal.window).toEqual({ kind: 'fixed', start: '2026-10-26', end: '2027-01-01' });
    });
});

describe('a deadline is not a name', () => {
    const today = new Date(2026, 8, 26); // 26 September 2026

    it('reads "by Jan 1" as the target date and keeps it out of the title', () => {
        // The reported bug: the goal was named after the day it was due.
        const result = parseGoalText('Launch Habyss by Jan 1', { today, habits: [] });
        expect(result.goal.title).toBe('Launch Habyss');
        expect(result.goal.window).toEqual({ kind: 'fixed', start: '2026-09-26', end: '2027-01-01' });
    });

    it('does the same for a goal with no number at all', () => {
        const result = parseGoalText('Finish the thesis by March 15', { today, habits: [] });
        expect(result.goal.title).toBe('Finish the thesis');
        expect(result.goal.window?.kind).toBe('fixed');
    });

    it('leaves a title alone when it names no date', () => {
        const result = parseGoalText('Launch Habyss', { today, habits: [] });
        expect(result.goal.title).toBe('Launch Habyss');
    });
});

describe('spans: for 365 days, for a year, within 6 months, before summer', () => {
    const today = new Date(2026, 9, 26);
    const read = (text: string) => parseGoalText(text, { today }).goal;
    it('"write a personal journal for 365 days" runs from today to 365 days later, counting days', () => {
        const goal = read('write a personal journal for 365 days');
        expect(goal).toMatchObject({ title: 'Write a personal journal', type: 'frequency', target: 365, metric_unit: 'days' });
        expect(goal.window).toEqual({ kind: 'fixed', start: '2026-10-26', end: '2027-10-26' });
    });
    it('reads the many ways of saying it', () => {
        expect(read('journal every day for a year')).toMatchObject({ title: 'Journal', target: 365, metric_unit: 'days' });
        expect(read('meditate daily for 30 days')).toMatchObject({ title: 'Meditate', target: 30 });
        expect(read('no sugar for 2 weeks')).toMatchObject({ title: 'No sugar', target: 14 });
        expect(read('read every day this year')).toMatchObject({ title: 'Read', metric_unit: 'days', window: { kind: 'fixed', start: '2026-10-26', end: '2026-12-31' } });
    });
    it('an amount within a span is a deadline for the amount', () => {
        expect(read('read 12 books within 6 months')).toMatchObject({ title: 'Read 12 books', target: 12, window: { kind: 'fixed', end: '2027-04-26' } });
        expect(read('learn spanish in a year').window).toEqual({ kind: 'fixed', start: '2026-10-26', end: '2027-10-26' });
    });
    it('a rhythm through a span counts every session, and keeps its wording', () => {
        expect(read('go to the gym 3 times a week for 6 months')).toMatchObject({ title: 'Go to the gym 3 times a week', target: 78, metric_unit: 'sessions' });
    });
    it('reads seasons as dates', () => {
        expect(read('lose 10 lbs before summer').window).toEqual({ kind: 'fixed', start: '2026-10-26', end: '2027-06-21' });
    });
});
