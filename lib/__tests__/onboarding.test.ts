import {
    describeRecurrence, draftTaskDays, draftToHabit, nextOccurrence,
    hasValidSchedule, rankSuggestions, recommendedTarget, shouldOfferReminder, shouldSuggestCue,
    SUGGESTIONS, type OnboardingDraft,
} from '../onboarding';
import { isHabitScheduledForDate } from '../habitSchedule';
import type { Habit } from '../habitsSQLite';

const base: OnboardingDraft = {
    step: 0,
    areaId: 'body',
    suggestionId: 'walk',
    habitName: 'Walk',
    targetValue: 15,
    targetUnit: 'min',
    trackingMethod: 'numeric',
    category: 'body',
    recurrence: 'daily',
    startDate: '2026-09-16',
};

describe('suggestions respond to the answers', () => {
    it('only offers habits from the chosen area', () => {
        expect(rankSuggestions('soul').every(s => s.area === 'soul')).toBe(true);
        expect(rankSuggestions('body').map(s => s.id)).not.toContain('meditate');
    });

    it('returns nothing until an area is chosen', () => {
        expect(rankSuggestions(undefined)).toEqual([]);
    });

    it('puts the shortest habits first when time is the obstacle', () => {
        const ranked = rankSuggestions('body', 'no_time');
        expect(ranked[0].id).toBe('stretch');
        expect(ranked.map(s => s.minutes)).toEqual([...ranked.map(s => s.minutes)].sort((a, b) => a - b));
    });

    it('leaves the default order for other obstacles', () => {
        expect(rankSuggestions('body', 'forgetting')[0].id).toBe('walk');
    });

    it('recommends the smaller prepared target when starting too big', () => {
        const read = SUGGESTIONS.find(s => s.id === 'read')!;
        expect(recommendedTarget(read, 'too_big')).toEqual({ value: 2, unit: 'pages' });
        expect(recommendedTarget(read, 'forgetting')).toEqual({ value: 10, unit: 'pages' });
    });

    it('uses each activity\'s own unit rather than scaling a number', () => {
        const walk = SUGGESTIONS.find(s => s.id === 'walk')!;
        const read = SUGGESTIONS.find(s => s.id === 'read')!;
        expect(walk.small.unit).toBe('min');
        expect(read.small.unit).toBe('pages');
    });

    it('offers a cue and reminder only for forgetting', () => {
        expect(shouldSuggestCue('forgetting')).toBe(true);
        expect(shouldOfferReminder('forgetting')).toBe(true);
        expect(shouldSuggestCue('no_time')).toBe(false);
        expect(shouldOfferReminder(undefined)).toBe(false);
    });
});

describe('draft becomes the habit that gets saved', () => {
    it('carries the confirmed target, unit and schedule', () => {
        const habit = draftToHabit(base);
        expect(habit).toMatchObject({
            name: 'Walk', goalValue: 15, unit: 'min', trackingMethod: 'numeric',
            startDate: '2026-09-16', taskDays: [], type: 'build',
        });
    });

    it('stores the routine cue as the habit description, not a reminder', () => {
        const habit = draftToHabit({ ...base, cue: 'After lunch' });
        expect(habit.description).toBe('After lunch');
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
        expect(draftToHabit({ ...base, habitName: '  Walk  ' }).name).toBe('Walk');
    });
});

describe('next occurrence', () => {
    it('is today when the habit runs daily and has started', () => {
        const from = new Date(2026, 8, 20);
        expect(nextOccurrence(base, from)?.getDate()).toBe(20);
    });

    it('waits for the start date when it is in the future', () => {
        const draft = { ...base, startDate: '2026-09-25' };
        const next = nextOccurrence(draft, new Date(2026, 8, 20));
        expect(next && next.getDate()).toBe(25);
    });

    it('skips to Monday for a weekday habit checked on Saturday', () => {
        const draft: OnboardingDraft = { ...base, recurrence: 'weekdays' };
        // 2026-09-19 is a Saturday.
        const next = nextOccurrence(draft, new Date(2026, 8, 19));
        expect(next?.getDay()).toBe(1);
        expect(next?.getDate()).toBe(21);
    });

    it('finds the chosen day for a custom recurrence', () => {
        const draft: OnboardingDraft = { ...base, recurrence: 'custom', taskDays: ['wed'] };
        const next = nextOccurrence(draft, new Date(2026, 8, 20));
        expect(next?.getDay()).toBe(3);
    });

    it('returns null when no day is selected rather than falling back to daily', () => {
        // The shared scheduler reads empty taskDays as every day; onboarding must
        // not promise a date for a schedule the user has not finished choosing.
        const draft: OnboardingDraft = { ...base, recurrence: 'custom', taskDays: [] };
        expect(nextOccurrence(draft, new Date(2026, 8, 20))).toBeNull();
        expect(hasValidSchedule(draft)).toBe(false);
        expect(hasValidSchedule({ ...draft, taskDays: ['mon'] })).toBe(true);
        expect(hasValidSchedule({ ...base })).toBe(true);
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
