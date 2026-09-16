import {
    coachCompletion, coachHomeMessage, coachNotLogged, coachPlanIntro,
    coachPreview, coachSystemPrompt, type CoachContext,
} from '../coachMessages';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';

const ALL: PersonalityModeId[] = PERSONALITY_MODES.map(mode => mode.id);

const plan: CoachContext = {
    habitName: 'Walk',
    target: '15 min',
    recurrence: 'Weekdays',
    cue: 'After lunch',
};

describe('every personality is covered', () => {
    it('has a voice for each personality the app offers', () => {
        for (const id of ALL) {
            expect(coachPreview(id, 'Walk').length).toBeGreaterThan(0);
            expect(coachPlanIntro(id, plan).length).toBeGreaterThan(0);
        }
    });

    it('falls back to the balanced voice for an unknown id', () => {
        const unknown = 'made_up' as PersonalityModeId;
        expect(coachPlanIntro(unknown, plan)).toBe(coachPlanIntro('normal', plan));
    });
});

describe('personality changes the delivery, not the facts', () => {
    it('gives a different plan introduction per personality', () => {
        const intros = ALL.map(id => coachPlanIntro(id, plan));
        expect(new Set(intros).size).toBe(ALL.length);
    });

    it('states the same habit, target and schedule whichever coach is chosen', () => {
        for (const id of ALL) {
            const intro = coachPlanIntro(id, plan);
            expect(intro).toContain('Walk');
            expect(intro).toContain('15 min');
            expect(intro.toLowerCase()).toContain('weekdays');
            expect(intro.toLowerCase()).toContain('after lunch');
        }
    });

    it('previews the same habit for every personality so they can be compared', () => {
        const previews = ALL.map(id => coachPreview(id, 'Meditate'));
        expect(previews.every(line => line.includes('Meditate'))).toBe(true);
        expect(new Set(previews).size).toBe(ALL.length);
    });

    it('keeps the warm voice longer than the blunt one', () => {
        expect(coachPreview('friendly', 'Walk').length).toBeGreaterThan(coachPreview('bully_mode', 'Walk').length);
    });
});

describe('nothing is invented', () => {
    it('never mentions a streak that was not recorded', () => {
        for (const id of ALL) {
            const message = coachCompletion(id, { habitName: 'Walk' });
            expect(message).not.toMatch(/\d+ days? in a row/);
        }
    });

    it('reports a streak only once there is one', () => {
        expect(coachCompletion('normal', { habitName: 'Walk', currentStreak: 1 })).not.toContain('in a row');
        expect(coachCompletion('normal', { habitName: 'Walk', currentStreak: 4 })).toContain('4 days in a row');
    });

    it('omits weekly progress when it was not supplied', () => {
        for (const id of ALL) {
            expect(coachHomeMessage(id, { habitName: 'Walk' })).not.toMatch(/\d+ of \d+/);
        }
        expect(coachHomeMessage('normal', { habitName: 'Walk', completedThisWeek: 2, scheduledThisWeek: 5 }))
            .toContain('2 of 5');
    });

    it('treats a missing completion as not logged, never as a failure', () => {
        for (const id of ALL) {
            const message = coachNotLogged(id, { habitName: 'Walk' }).toLowerCase();
            expect(message).toContain('not logged');
            expect(message).not.toMatch(/you failed|you skipped|you didn't do|gave up/);
        }
    });
});

describe('direct coaching stays respectful', () => {
    const insults = /\b(weak|pathetic|embarrassing|lazy|useless|disgrace|excuses)\b/i;
    const guilt = /\b(disappointed in you|let me down|you always|you never)\b/i;

    it('avoids insults and guilt in every personality and message type', () => {
        const contexts: CoachContext[] = [
            { habitName: 'Walk' },
            { habitName: 'Walk', currentStreak: 3 },
            { habitName: 'Walk', completedThisWeek: 1, scheduledThisWeek: 5 },
        ];
        for (const id of ALL) {
            for (const context of contexts) {
                for (const message of [
                    coachPlanIntro(id, context), coachCompletion(id, context),
                    coachNotLogged(id, context), coachHomeMessage(id, context), coachPreview(id, context.habitName),
                ]) {
                    expect(message).not.toMatch(insults);
                    expect(message).not.toMatch(guilt);
                }
            }
        }
    });
});

describe('system prompt for the on-device model', () => {
    it('passes only the facts it was given', () => {
        const prompt = coachSystemPrompt('dad_mode', { habitName: 'Walk', target: '15 min' });
        expect(prompt).toContain('Habit: Walk');
        expect(prompt).toContain('Target: 15 min');
        expect(prompt).not.toContain('Current streak');
        expect(prompt).not.toContain('Logged this week');
    });

    it('includes the chosen personality and the grounding rules', () => {
        const prompt = coachSystemPrompt('friendly', plan);
        expect(prompt).toContain(PERSONALITY_MODES[0].systemPrompt);
        expect(prompt).toContain('Never invent progress');
        expect(prompt).toContain('Never change the user');
    });
});
