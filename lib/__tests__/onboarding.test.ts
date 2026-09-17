import {
    AREAS, MAX_AREAS, OBSTACLES, SUGGESTIONS, SUPPORTS,
    coachForSupport, describeRecurrence, draftTaskDays, draftToHabit, hasValidSchedule,
    nextOccurrence, obstacleResponse, prefersNumericTracking, rankSuggestions,
    recommendedTarget, shouldOfferReminder, shouldSuggestCue,
    type ObstacleId, type OnboardingDraft, type SupportId,
} from '../onboarding';
import { isHabitScheduledForDate } from '../habitSchedule';
import type { Habit } from '../habitsSQLite';

const base: OnboardingDraft = {
    step: 0,
    name: 'Erwan',
    areaIds: ['body'],
    suggestionId: 'walk',
    habitName: 'Walk',
    targetValue: 15,
    targetUnit: 'min',
    trackingMethod: 'numeric',
    category: 'body',
    recurrence: 'daily',
    startDate: '2026-09-16',
};

const ALL_OBSTACLES = OBSTACLES.map(o => o.id);
const ALL_SUPPORTS = SUPPORTS.map(s => s.id);

describe('the option lists match the flow', () => {
    it('offers six areas including an escape hatch', () => {
        expect(AREAS).toHaveLength(6);
        expect(AREAS.map(a => a.id)).toContain('other');
    });

    it('offers six obstacles, each with its own response', () => {
        expect(OBSTACLES).toHaveLength(6);
        const responses = OBSTACLES.map(o => o.response);
        expect(new Set(responses).size).toBe(6);
        expect(responses.every(line => line.trim().length > 0)).toBe(true);
    });

    it('offers five kinds of support', () => {
        expect(SUPPORTS).toHaveLength(5);
        expect(SUPPORTS.every(s => s.blurb.trim().length > 0)).toBe(true);
    });

    it('caps the areas at two', () => {
        expect(MAX_AREAS).toBe(2);
    });

    it('has at least one suggestion for every area', () => {
        for (const area of AREAS) {
            expect(SUGGESTIONS.some(s => s.areas.includes(area.id))).toBe(true);
        }
    });
});

describe('areas filter the suggestions', () => {
    it('returns nothing until an area is chosen', () => {
        expect(rankSuggestions(undefined)).toEqual([]);
        expect(rankSuggestions([])).toEqual([]);
    });

    it('only offers habits from the chosen areas', () => {
        expect(rankSuggestions(['calm']).every(s => s.areas.includes('calm'))).toBe(true);
        expect(rankSuggestions(['body']).map(s => s.id)).not.toContain('meditate');
    });

    it('draws from both areas when two are picked', () => {
        const ranked = rankSuggestions(['body', 'learning']);
        expect(ranked.some(s => s.areas.includes('body'))).toBe(true);
        expect(ranked.some(s => s.areas.includes('learning'))).toBe(true);
    });

    it('alternates the two areas so the second is not buried', () => {
        const ranked = rankSuggestions(['body', 'learning']);
        // The second entry should come from the other area.
        expect(ranked[0].areas).toContain('body');
        expect(ranked[1].areas).toContain('learning');
    });

    it('never repeats a habit that belongs to both areas', () => {
        const ranked = rankSuggestions(['calm', 'routine']);
        expect(new Set(ranked.map(s => s.id)).size).toBe(ranked.length);
    });
});

describe('the obstacle changes the recommendation', () => {
    it('has a response for every obstacle and none for no answer', () => {
        for (const id of ALL_OBSTACLES) expect(obstacleResponse(id)).toBeTruthy();
        expect(obstacleResponse(undefined)).toBeNull();
    });

    it('recommends the smaller target when the problem is scale', () => {
        const read = SUGGESTIONS.find(s => s.id === 'read')!;
        for (const id of ['putting_off', 'momentum', 'overwhelmed', 'restarting'] as ObstacleId[]) {
            expect(recommendedTarget(read, id)).toEqual(read.small);
        }
        // Forgetting is not a scale problem, so the target is left alone.
        expect(recommendedTarget(read, 'forgetting')).toEqual(read.standard);
        expect(recommendedTarget(read, undefined)).toEqual(read.standard);
    });

    it('uses each activity\'s own unit rather than scaling a number', () => {
        expect(SUGGESTIONS.find(s => s.id === 'walk')!.small.unit).toBe('min');
        expect(SUGGESTIONS.find(s => s.id === 'read')!.small.unit).toBe('pages');
    });

    it('puts the quickest habits first when the problem is starting', () => {
        for (const id of ['putting_off', 'overwhelmed'] as ObstacleId[]) {
            const minutes = rankSuggestions(['body'], id).map(s => s.minutes);
            expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
        }
    });

    it('suggests a routine cue only for forgetting', () => {
        expect(shouldSuggestCue('forgetting')).toBe(true);
        for (const id of ALL_OBSTACLES.filter(o => o !== 'forgetting')) {
            expect(shouldSuggestCue(id)).toBe(false);
        }
    });

    it('offers a reminder for forgetting and for wanting a check-in', () => {
        expect(shouldOfferReminder('forgetting')).toBe(true);
        expect(shouldOfferReminder('accountability')).toBe(true);
        expect(shouldOfferReminder('momentum')).toBe(false);
        // Asking for accountability as support is enough on its own.
        expect(shouldOfferReminder('momentum', 'accountability')).toBe(true);
        expect(shouldOfferReminder(undefined, undefined)).toBe(false);
    });
});

describe('the support answer changes real behaviour', () => {
    it('picks a coach for every option', () => {
        for (const id of ALL_SUPPORTS) {
            expect(coachForSupport(id)).toBeTruthy();
        }
    });

    it('maps each kind of support to a coach that behaves that way', () => {
        expect(coachForSupport('consistency')).toBe('dad_mode');
        expect(coachForSupport('accountability')).toBe('dad_mode');
        expect(coachForSupport('fresh_start')).toBe('friendly');
        expect(coachForSupport('clear_plan')).toBe('normal');
        expect(coachForSupport('progress')).toBe('normal');
        expect(coachForSupport(undefined)).toBe('normal');
    });

    it('prefers a counted target when the user wants visible progress', () => {
        expect(prefersNumericTracking('progress')).toBe(true);
        for (const id of ALL_SUPPORTS.filter(s => s !== 'progress')) {
            expect(prefersNumericTracking(id as SupportId)).toBe(false);
        }
    });

    it('gives every option at least one effect', () => {
        for (const id of ALL_SUPPORTS) {
            const changesCoach = coachForSupport(id) !== 'normal';
            const changesReminder = shouldOfferReminder(undefined, id);
            const changesTracking = prefersNumericTracking(id);
            const isDefaultPlan = id === 'clear_plan';
            expect(changesCoach || changesReminder || changesTracking || isDefaultPlan).toBe(true);
        }
    });
});

describe('draft becomes the habit that gets saved', () => {
    it('carries the confirmed target, unit and schedule', () => {
        expect(draftToHabit(base)).toMatchObject({
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

    it('never puts the onboarding answers on the habit', () => {
        const habit = draftToHabit({ ...base, supportId: 'progress', obstacleId: 'momentum' }) as Record<string, unknown>;
        expect(JSON.stringify(habit)).not.toContain('progress');
        expect(JSON.stringify(habit)).not.toContain('momentum');
    });
});

describe('next occurrence', () => {
    it('is today when the habit runs daily and has started', () => {
        expect(nextOccurrence(base, new Date(2026, 8, 20))?.getDate()).toBe(20);
    });

    it('waits for the start date when it is in the future', () => {
        const next = nextOccurrence({ ...base, startDate: '2026-09-25' }, new Date(2026, 8, 20));
        expect(next && next.getDate()).toBe(25);
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
