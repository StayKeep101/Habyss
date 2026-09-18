import { buildRoadmap, checkpointsForGoal, daysAvailable, habitForGoal, tidy } from '../roadmapPlan';
import { parseGoalText, type GoalSpec } from '../goalParser';

const TODAY = new Date(2026, 8, 17); // 2026-09-17
const specFor = (text: string): GoalSpec => parseGoalText(text, { today: TODAY, habits: [] }).goal;

describe('the habit that does the work', () => {
    it('spreads a counted target across the days available', () => {
        // 50 km between 17 and 30 September is 14 days.
        const spec = specFor('Run 50 km this month');
        const habit = habitForGoal(spec, 15, daysAvailable(spec, TODAY));
        expect(habit.targetUnit).toBe('km');
        expect(habit.targetValue).toBeCloseTo(3.6, 1);
        expect(habit.trackingMethod).toBe('numeric');
    });

    it('doing the daily amount actually arrives at the goal', () => {
        const spec = specFor('Read 280 pages this month');
        const days = daysAvailable(spec, TODAY);
        const habit = habitForGoal(spec, 15, days);
        // Within a page or so of the real target, not approximately near it.
        expect(Math.abs(habit.targetValue * days - (spec.target ?? 0))).toBeLessThan(days);
    });

    it('falls back to the minutes the user offered when nothing is countable', () => {
        const spec = specFor('Meditate 5 times a week');
        const habit = habitForGoal(spec, 30, daysAvailable(spec, TODAY));
        expect(habit.targetUnit).toBe('min');
        expect(habit.targetValue).toBe(30);
    });

    it('never asks for less than a real unit of work', () => {
        const spec = specFor('Run 2 km this month');
        expect(habitForGoal(spec, 15, daysAvailable(spec, TODAY)).targetValue).toBeGreaterThanOrEqual(1);
    });

    it('names the habit after the action, not the whole goal sentence', () => {
        const spec = specFor('Run 50 km this month');
        expect(habitForGoal(spec, 15, 14).name.toLowerCase()).toContain('run');
    });
});

describe('checkpoints along the way', () => {
    it('splits the target across the window and ends on the goal', () => {
        const steps = checkpointsForGoal(specFor('Run 50 km this month'), TODAY, 3);
        expect(steps.length).toBe(4);
        expect(steps[steps.length - 1].dueDate).toBe('2026-09-30');
        expect(steps[steps.length - 1].targetValue).toBe(50);
        // Each checkpoint is further along than the last, in both amount and date.
        for (let i = 1; i < steps.length; i += 1) {
            expect(steps[i].targetValue!).toBeGreaterThan(steps[i - 1].targetValue!);
            expect(steps[i].dueDate >= steps[i - 1].dueDate).toBe(true);
        }
    });

    it('puts every checkpoint inside the window', () => {
        const spec = specFor('Run 50 km this month');
        for (const step of checkpointsForGoal(spec, TODAY, 3)) {
            expect(step.dueDate >= '2026-09-17').toBe(true);
            expect(step.dueDate <= '2026-09-30').toBe(true);
        }
    });

    it('gives a repeating goal nothing to check off', () => {
        // "Every week" has no finish line to divide.
        expect(checkpointsForGoal(specFor('Gym 3x a week'), TODAY)).toEqual([]);
    });

    it('does not invent dates in a window too short to hold them', () => {
        const spec = { ...specFor('Run 50 km this month'), window: { kind: 'fixed' as const, start: '2026-09-17', end: '2026-09-18' } };
        expect(checkpointsForGoal(spec, TODAY, 3).length).toBeLessThanOrEqual(1);
    });

    it('says "still under" for a limit rather than "reach"', () => {
        const spec = { ...specFor('Run 50 km this month'), direction: 'at_most' as const };
        expect(checkpointsForGoal(spec, TODAY, 2)[0].title).toContain('Still under');
    });

    it('labels checkpoints plainly when there is no number to divide', () => {
        const spec = { ...specFor('Run 50 km this month'), target: null, metric_unit: null };
        const steps = checkpointsForGoal(spec, TODAY, 2);
        expect(steps[0].title).toMatch(/Checkpoint/);
        expect(steps[steps.length - 1].title).toBe('Goal day');
    });
});

describe('the whole path', () => {
    it('produces a habit and checkpoints from one confirmed goal', () => {
        const roadmap = buildRoadmap(specFor('Run 50 km this month'), { today: TODAY, minutesPerDay: 15 });
        expect(roadmap.habit.name.toLowerCase()).toContain('run');
        expect(roadmap.steps.length).toBeGreaterThan(0);
        expect(new Set(roadmap.steps.map(s => s.id)).size).toBe(roadmap.steps.length);
    });

    it('still gives a habit when the goal has no checkpoints', () => {
        const roadmap = buildRoadmap(specFor('Gym 3x a week'), { today: TODAY, minutesPerDay: 30 });
        expect(roadmap.habit.targetValue).toBe(30);
        expect(roadmap.steps).toEqual([]);
    });
});

describe('tidy', () => {
    it('keeps whole numbers whole and rounds the rest to one place', () => {
        expect(tidy(5)).toBe(5);
        expect(tidy(3.5714)).toBe(3.6);
        expect(tidy(12.5)).toBe(12.5);
    });
});
