import {
    describeRecurrence, draftTaskDays, draftToHabit, hasValidSchedule, nextOccurrence,
    type OnboardingDraft,
} from '../onboarding';
import { isHabitScheduledForDate } from '../habitSchedule';
import type { Habit } from '../habitsSQLite';

/** What the seven answers produce: one daily habit feeding a measurable goal. */
const base: OnboardingDraft = {
    step: 0,
    identityGoal: 'Run a 10K without stopping',
    attempts: 'many',
    killers: ['bad_day'],
    tone: 'straight',
    timeBudget: 30,
    measurableText: 'Run 50 km this month',
    habitName: 'Run',
    targetValue: 15,
    targetUnit: 'min',
    trackingMethod: 'numeric',
    recurrence: 'daily',
    startDate: '2026-09-16',
};

describe('the draft becomes the habit that gets saved', () => {
    it('carries the target, unit and schedule', () => {
        expect(draftToHabit(base)).toMatchObject({
            name: 'Run', goalValue: 15, unit: 'min', trackingMethod: 'numeric',
            startDate: '2026-09-16', taskDays: [], type: 'build',
        });
    });

    it('stores the routine cue as the description, not a reminder', () => {
        const habit = draftToHabit({ ...base, cue: 'After work' });
        expect(habit.description).toBe('After work');
        expect(habit.reminders).toEqual([]);
    });

    it('only schedules a reminder when a time was chosen', () => {
        expect(draftToHabit(base).reminders).toEqual([]);
        expect(draftToHabit({ ...base, reminderTime: '07:30' }).reminders).toEqual(['07:30']);
    });

    it('maps recurrence to the days the scheduler understands', () => {
        expect(draftTaskDays({ ...base, recurrence: 'weekdays' })).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
        expect(draftTaskDays({ ...base, recurrence: 'custom', taskDays: ['sat'] })).toEqual(['sat']);
        expect(draftTaskDays(base)).toEqual([]);
    });

    it('trims the name so a stray space cannot create an oddly named habit', () => {
        expect(draftToHabit({ ...base, habitName: '  Run  ' }).name).toBe('Run');
    });

    it('never writes the onboarding answers onto the habit', () => {
        // The answers shape the plan; they are not habit fields.
        const serialised = JSON.stringify(draftToHabit(base));
        for (const answer of ['bad_day', 'straight', 'many', 'Run a 10K without stopping']) {
            expect(serialised).not.toContain(answer);
        }
    });
});

describe('next occurrence', () => {
    it('is today when the habit runs daily and has started', () => {
        expect(nextOccurrence(base, new Date(2026, 8, 20))?.getDate()).toBe(20);
    });

    it('waits for a start date in the future', () => {
        const next = nextOccurrence({ ...base, startDate: '2026-09-25' }, new Date(2026, 8, 20));
        expect(next?.getDate()).toBe(25);
    });

    it('skips to Monday for a weekday habit checked on Saturday', () => {
        // 2026-09-19 is a Saturday.
        const next = nextOccurrence({ ...base, recurrence: 'weekdays' }, new Date(2026, 8, 19));
        expect(next?.getDay()).toBe(1);
        expect(next?.getDate()).toBe(21);
    });

    it('returns null when no day is selected rather than falling back to daily', () => {
        const draft: OnboardingDraft = { ...base, recurrence: 'custom', taskDays: [] };
        expect(nextOccurrence(draft, new Date(2026, 8, 20))).toBeNull();
        expect(hasValidSchedule(draft)).toBe(false);
        expect(hasValidSchedule({ ...draft, taskDays: ['mon'] })).toBe(true);
    });

    it('agrees with the scheduler the rest of the app uses', () => {
        const draft: OnboardingDraft = { ...base, recurrence: 'custom', taskDays: ['tue', 'thu'] };
        const next = nextOccurrence(draft, new Date(2026, 8, 20))!;
        expect(isHabitScheduledForDate(draftToHabit(draft) as Habit, next)).toBe(true);
    });
});

describe('describeRecurrence', () => {
    it('describes each recurrence in the user\'s words', () => {
        expect(describeRecurrence(base)).toBe('Every day');
        expect(describeRecurrence({ ...base, recurrence: 'weekdays' })).toBe('Weekdays');
        expect(describeRecurrence({ ...base, recurrence: 'custom', taskDays: ['mon', 'wed'] })).toBe('Mon, Wed');
        expect(describeRecurrence({ ...base, recurrence: 'custom', taskDays: [] })).toBe('No days chosen');
    });
});
