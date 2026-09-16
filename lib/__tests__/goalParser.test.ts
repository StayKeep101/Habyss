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
        expect(result.goal.title).toContain('September');
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
                'aggregation', 'baseline', 'direction', 'linked_habits', 'metric_unit',
                'suggested_habit', 'target', 'title', 'type', 'window',
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
