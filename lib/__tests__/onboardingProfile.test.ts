import {
    BLOCKERS, CHRONOTYPES, HOPES, SLEEP_AMOUNTS, SOURCES, TIMINGS,
    dayWindowFor, shouldOfferFriends, shouldOfferReminders, suggestEcho,
} from '../onboardingProfile';

describe('the voice Echo starts with', () => {
    it('is firm for someone who only moves at a deadline', () => {
        const suggestion = suggestEcho({ timing: 'last_minute' });
        expect(suggestion.id).toBe('dad_mode');
        expect(suggestion.reason).toContain('deadline');
    });

    it('is firm for someone who says things slide', () => {
        expect(suggestEcho({ timing: 'rarely' }).id).toBe('dad_mode');
    });

    it('is gentle for someone underwater, even if they also run late', () => {
        // Pushing a person who is already drowning is not motivation.
        const suggestion = suggestEcho({ timing: 'last_minute', blockers: ['overwhelmed'] });
        expect(suggestion.id).toBe('friendly');
        expect(suggestion.reason).toContain('too much');
    });

    it('is gentle for someone who is exhausted, however they work', () => {
        expect(suggestEcho({ timing: 'last_minute', blockers: ['too_tired'] }).id).toBe('friendly');
        expect(suggestEcho({ timing: 'rarely', sleepAmount: 'under_six' }).id).toBe('friendly');
    });

    it('takes the pressure off a perfectionist rather than adding to it', () => {
        expect(suggestEcho({ blockers: ['perfect'] }).id).toBe('friendly');
    });

    it('keeps out of the way of someone who already gets things done', () => {
        const suggestion = suggestEcho({ timing: 'straight_away' });
        expect(suggestion.id).toBe('normal');
        expect(suggestion.reason).toContain('keep out of the way');
    });

    it('never picks the harshest voice for anyone', () => {
        // It exists for people who go looking for it, never by inference.
        const every = [
            {}, { timing: 'rarely' as const }, { timing: 'last_minute' as const },
            { blockers: BLOCKERS.map(item => item.id) },
            { timing: 'rarely' as const, blockers: BLOCKERS.map(item => item.id), sleepAmount: 'under_six' as const },
        ];
        for (const profile of every) expect(suggestEcho(profile).id).not.toBe('bully_mode');
    });

    it('always explains itself', () => {
        for (const profile of [{}, { timing: 'planned' as const }, { blockers: ['motivation' as const] }]) {
            expect(suggestEcho(profile).reason.length).toBeGreaterThan(10);
        }
    });
});

describe('the day a chronotype implies', () => {
    it('starts an early bird early and a night owl late', () => {
        expect(dayWindowFor('early_bird')).toEqual({ wake: '06:00', sleep: '22:00' });
        expect(dayWindowFor('night_owl')).toEqual({ wake: '09:00', sleep: '01:00' });
    });

    it('falls back to an ordinary day when nothing was said', () => {
        expect(dayWindowFor(undefined)).toEqual({ wake: '07:00', sleep: '23:00' });
    });
});

describe('what the answers switch on', () => {
    it('offers friends only to someone who said it would help', () => {
        expect(shouldOfferFriends({ blockers: ['alone'] })).toBe(true);
        expect(shouldOfferFriends({ hope: ['together'] })).toBe(true);
        expect(shouldOfferFriends({ blockers: ['no_time'], hope: ['calm'] })).toBe(false);
        expect(shouldOfferFriends({})).toBe(false);
    });

    it('offers reminders to someone who said they forget', () => {
        expect(shouldOfferReminders({ blockers: ['forget'] })).toBe(true);
        expect(shouldOfferReminders({ blockers: ['motivation'] })).toBe(false);
    });
});

describe('the questions themselves', () => {
    it('offers real options with nothing blank', () => {
        for (const list of [SOURCES, HOPES, CHRONOTYPES, SLEEP_AMOUNTS, TIMINGS, BLOCKERS]) {
            expect(list.length).toBeGreaterThan(2);
            for (const option of list) {
                expect(option.id).toBeTruthy();
                expect(option.label.trim().length).toBeGreaterThan(3);
            }
        }
    });

    it('has no duplicate ids to silently overwrite an answer', () => {
        for (const list of [SOURCES, HOPES, CHRONOTYPES, SLEEP_AMOUNTS, TIMINGS, BLOCKERS]) {
            const ids = list.map(option => option.id);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });
});
