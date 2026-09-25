import { planFromDraft, resolveGoal } from '../onboardingPlan';
import type { OnboardingDraft } from '../onboarding';

const NOW = new Date(2026, 8, 18, 10); // 2026-09-18

/** A user who has answered everything and edited the roadmap. */
const completed: OnboardingDraft = {
    step: 9,
    identityGoal: 'Run a 10K without stopping',
    attempts: 'many',
    killers: ['bad_day', 'no_accountability'],
    stakesText: '  Another year of feeling the same way  ',
    tone: 'drill',
    timeBudget: 30,
    measurableText: 'Run 50 km this month',
    habitName: 'Evening run',
    targetValue: 4,
    targetUnit: 'km',
    trackingMethod: 'numeric',
    roadmapSteps: [
        { id: 'checkpoint_1', title: 'Reach 12.5 km', dueDate: '2026-09-21' },
        { id: 'custom', title: '   ', dueDate: '2026-09-24' },
        { id: 'checkpoint_final', title: 'Reach 50 km', dueDate: '2026-09-30' },
    ],
};

describe('the roadmap edits are what get saved', () => {
    it('keeps the habit name the user typed', () => {
        // Regression: the save used to overwrite this with the parser's suggestion.
        expect(planFromDraft(completed, NOW).habit.name).toBe('Evening run');
    });

    it('keeps the daily amount and unit from the roadmap', () => {
        // Regression: the save used to force every habit into minutes.
        const { habit } = planFromDraft(completed, NOW);
        expect(habit.goalValue).toBe(4);
        expect(habit.unit).toBe('km');
        expect(habit.trackingMethod).toBe('numeric');
    });

    it('falls back to the time budget only when the roadmap was never built', () => {
        const draft: OnboardingDraft = { ...completed, habitName: undefined, targetValue: undefined, targetUnit: undefined };
        const { habit } = planFromDraft(draft, NOW);
        // 30 minutes, halved because one bad day turns into a bad week.
        expect(habit.goalValue).toBe(15);
        expect(habit.unit).toBe('min');
        expect(habit.name!.toLowerCase()).toContain('run');
    });

    it('starts the habit today', () => {
        expect(planFromDraft(completed, NOW).habit.startDate).toBe('2026-09-18');
    });
});

describe('the goal', () => {
    it('stores the measurable target, window and full contract', () => {
        const { goal } = planFromDraft(completed, NOW);
        expect(goal).toMatchObject({
            isGoal: true, goalValue: 50, unit: 'km', targetDate: '2026-09-30',
        });
        expect(JSON.parse(goal.goalSpec!)).toMatchObject({ type: 'volume', target: 50 });
    });

    it('turns a repeating goal into a period rather than a deadline', () => {
        const { goal } = planFromDraft({ ...completed, measurableText: 'Gym 3x a week' }, NOW);
        expect(goal.goalPeriod).toBe('weekly');
        expect(goal.targetDate).toBeUndefined();
    });

    it('resolves "lose 5 kg" against the weight the user gave', () => {
        const spec = resolveGoal({ ...completed, measurableText: 'Lose 5kg by christmas', baselineText: '82' }, NOW);
        expect(spec.baseline).toBe(82);
        expect(spec.target).toBe(77);
    });

    it('leaves the target unset until a baseline exists, rather than storing 5 kg', () => {
        const spec = resolveGoal({ ...completed, measurableText: 'Lose 5kg by christmas' }, NOW);
        expect(spec.target).toBeNull();
    });

    it('ignores a baseline that is not a number', () => {
        const spec = resolveGoal({ ...completed, measurableText: 'Lose 5kg by christmas', baselineText: 'eighty' }, NOW);
        expect(spec.baseline).toBeNull();
    });
});

describe('the path', () => {
    it('turns each named checkpoint into a task and drops blank ones', () => {
        const { tasks } = planFromDraft(completed, NOW);
        expect(tasks.map(t => t.title)).toEqual(['Reach 12.5 km', 'Reach 50 km']);
        expect(tasks.map(t => t.stepId)).toEqual(['checkpoint_1', 'checkpoint_final']);
    });

    it('keeps the user\'s decision to have no checkpoints', () => {
        expect(planFromDraft({ ...completed, roadmapSteps: [] }, NOW).tasks).toEqual([]);
    });
});

describe('the rest of the answers', () => {
    it('picks the coach from the tone answer', () => {
        expect(planFromDraft(completed, NOW).coach).toBe('dad_mode');
        expect(planFromDraft({ ...completed, tone: 'encouraging' }, NOW).coach).toBe('friendly');
    });

    it('trims the stakes, and keeps nothing when they skipped it', () => {
        expect(planFromDraft(completed, NOW).stakes).toBe('Another year of feeling the same way');
        expect(planFromDraft({ ...completed, stakesText: '   ' }, NOW).stakes).toBeNull();
        expect(planFromDraft({ ...completed, stakesText: undefined }, NOW).stakes).toBeNull();
    });
});

describe('a plan of habits and tasks', () => {
    const withItems = (items: { id: string; kind: 'habit' | 'task'; title: string; dueDate?: string }[]) => ({
        ...completed,
        planItems: items,
    });

    it('creates every habit the user added, the first one carrying the amount', () => {
        const plan = planFromDraft(withItems([
            { id: 'h1', kind: 'habit', title: 'Evening run' },
            { id: 'h2', kind: 'habit', title: 'Stretch' },
        ]), NOW);
        expect(plan.habits.map(habit => habit.name)).toEqual(['Evening run', 'Stretch']);
        expect(plan.habits[0].goalValue).toBeDefined();
        expect(plan.habits[1].trackingMethod).toBe('boolean');
    });

    it('turns the dated items into tasks and leaves blank ones out', () => {
        const plan = planFromDraft(withItems([
            { id: 'h1', kind: 'habit', title: 'Evening run' },
            { id: 't1', kind: 'task', title: 'Sign up for the race', dueDate: '2026-10-01' },
            { id: 't2', kind: 'task', title: '   ', dueDate: '2026-10-15' },
        ]), NOW);
        expect(plan.tasks).toEqual([{ stepId: 't1', title: 'Sign up for the race', dueDate: '2026-10-01' }]);
    });

    it('accepts a goal made only of tasks', () => {
        const plan = planFromDraft(withItems([
            { id: 't1', kind: 'task', title: 'Book the venue', dueDate: '2026-10-01' },
        ]), NOW);
        expect(plan.tasks).toHaveLength(1);
        expect(plan.habits.filter(habit => habit.name?.trim())).toHaveLength(1); // the fallback habit only
    });
});
