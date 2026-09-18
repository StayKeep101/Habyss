import {
    ATTEMPTS, KILLERS, TIME_BUDGETS, TONES,
    coachForTone, dailyTargetMinutes, hasTriedBefore, isVeteranOfFailedStarts,
    payoffHeadline, planFor, prefersSmallSteps, shouldOfferReminder,
    shouldSuggestSharing, wantsExplicitCue,
    type KillerId,
} from '../onboardingAnswers';

const ALL_KILLERS = KILLERS.map(k => k.id);

describe('the option lists', () => {
    it('offers the four attempt answers', () => {
        expect(ATTEMPTS).toHaveLength(4);
    });

    it('offers six momentum killers, each with a plan', () => {
        expect(KILLERS).toHaveLength(6);
        expect(KILLERS.every(k => k.plan.trim().length > 0)).toBe(true);
        expect(new Set(KILLERS.map(k => k.plan)).size).toBe(6);
    });

    it('offers three tones and four time budgets', () => {
        expect(TONES).toHaveLength(3);
        expect(TIME_BUDGETS.map(t => t.id)).toEqual([5, 15, 30, 60]);
    });
});

describe('every answer changes something', () => {
    it('gives each momentum killer at least one effect', () => {
        for (const id of ALL_KILLERS) {
            const only = [id];
            const effects = [
                shouldOfferReminder(only),
                prefersSmallSteps(only),
                wantsExplicitCue(only),
                shouldSuggestSharing(only),
            ];
            // Plus the plan line, which every killer has.
            expect(effects.some(Boolean) || planFor(only).length > 0).toBe(true);
            expect(planFor(only)).toHaveLength(1);
        }
    });

    it('maps each tone to a different coach', () => {
        const coaches = TONES.map(t => coachForTone(t.id));
        expect(new Set(coaches).size).toBe(TONES.length);
        expect(coachForTone('encouraging')).toBe('friendly');
        expect(coachForTone('straight')).toBe('normal');
        expect(coachForTone('drill')).toBe('dad_mode');
        expect(coachForTone(undefined)).toBe('normal');
    });
});

describe('momentum killers drive the right features', () => {
    it('offers a reminder for busyness and missing accountability only', () => {
        expect(shouldOfferReminder(['busy'])).toBe(true);
        expect(shouldOfferReminder(['no_accountability'])).toBe(true);
        expect(shouldOfferReminder(['all_or_nothing'])).toBe(false);
        expect(shouldOfferReminder([])).toBe(false);
        expect(shouldOfferReminder(undefined)).toBe(false);
    });

    it('shrinks the target for all-or-nothing, bad days and fading motivation', () => {
        for (const id of ['all_or_nothing', 'bad_day', 'motivation_fades'] as KillerId[]) {
            expect(prefersSmallSteps([id])).toBe(true);
        }
        expect(prefersSmallSteps(['busy'])).toBe(false);
    });

    it('anchors the action to a cue when the user does not know what to do', () => {
        expect(wantsExplicitCue(['dont_know'])).toBe(true);
        expect(wantsExplicitCue(['busy'])).toBe(false);
    });

    it('suggests inviting someone only to the person who asked for accountability', () => {
        expect(shouldSuggestSharing(['no_accountability'])).toBe(true);
        expect(shouldSuggestSharing(['busy', 'bad_day'])).toBe(false);
    });

    it('combines several answers rather than taking only the first', () => {
        const both: KillerId[] = ['busy', 'all_or_nothing'];
        expect(shouldOfferReminder(both)).toBe(true);
        expect(prefersSmallSteps(both)).toBe(true);
        expect(planFor(both)).toHaveLength(2);
    });
});

describe('the time budget sizes the daily target', () => {
    it('uses what the user said when nothing calls for less', () => {
        expect(dailyTargetMinutes(5)).toBe(5);
        expect(dailyTargetMinutes(15)).toBe(15);
        expect(dailyTargetMinutes(60)).toBe(60);
    });

    it('halves it when the failure mode is quitting after a miss', () => {
        expect(dailyTargetMinutes(30, ['all_or_nothing'])).toBe(15);
        expect(dailyTargetMinutes(60, ['bad_day'])).toBe(30);
    });

    it('never drops below a real unit of work', () => {
        expect(dailyTargetMinutes(5, ['all_or_nothing'])).toBe(5);
    });

    it('falls back sensibly when the question was skipped', () => {
        expect(dailyTargetMinutes(undefined)).toBe(15);
    });
});

describe('attempts set how the coach opens', () => {
    it('knows who has been here before', () => {
        expect(hasTriedBefore('first')).toBe(false);
        expect(hasTriedBefore('few')).toBe(true);
        expect(isVeteranOfFailedStarts('few')).toBe(false);
        expect(isVeteranOfFailedStarts('many')).toBe(true);
        expect(isVeteranOfFailedStarts('lost_count')).toBe(true);
    });
});

describe('the payoff speaks back in their words', () => {
    it('names the pattern they picked', () => {
        const line = payoffHeadline('many', ['bad_day']);
        expect(line).toContain('started this before');
        expect(line.toLowerCase()).toContain('one bad day turns into a bad week');
    });

    it('drops the history line for a first-timer', () => {
        expect(payoffHeadline('first', ['busy'])).not.toContain('started this before');
        expect(payoffHeadline('first', ['busy']).toLowerCase()).toContain('get busy');
    });

    it('still says something useful when questions were skipped', () => {
        expect(payoffHeadline(undefined, undefined).length).toBeGreaterThan(0);
        expect(payoffHeadline('many', [])).toContain('started this before');
    });

    it('never claims progress the user has not made', () => {
        for (const attempts of ATTEMPTS.map(a => a.id)) {
            const line = payoffHeadline(attempts, ALL_KILLERS);
            expect(line.toLowerCase()).not.toMatch(/streak|you did|well done|congratulations/);
        }
    });
});
