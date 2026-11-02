jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) }));

import { ascentReducer, currentBeat, initialAscent, lineOf, progressOf, stageOf, type AscentState } from '../ascent/machine';
import { COMPOUND, SCENES, goalTitle, screenYears, suggestions, yearsLabel, type Answers } from '../ascent/story';
import { buildEcho } from '../ascent/echoBuild';
import { stepOf, whenOf } from '../ascent/plan';

const answer = (state: AscentState, patch: Partial<Answers>) => ascentReducer(state, { type: 'answer', patch });
const tap = (state: AscentState) => ascentReducer(state, { type: 'next' });
const at = (scene: string): AscentState => ({ ...initialAscent(), scene: SCENES.findIndex(item => item.id === scene) });
/** Taps through lines until the story waits for something. */
const toWait = (state: AscentState) => {
    let next = state;
    for (let guard = 0; guard < 40 && currentBeat(next)?.kind === 'line'; guard++) next = tap(next);
    return next;
};

/** Plays the whole story with these answers, as a person would, to the last button. */
function play(given: Answers): AscentState {
    let state = initialAscent();
    for (let guard = 0; guard < 200; guard++) {
        const beat = currentBeat(state);
        if (!beat || beat.kind === 'begin') return state;
        if (beat.kind === 'line') state = tap(state);
        else if (beat.kind === 'choice' || beat.kind === 'multi') state = answer(state, { [beat.field]: given[beat.field] });
        else if (beat.kind === 'input') state = answer(state, { name: given.name ?? '' });
        else if (beat.kind === 'day') state = answer(state, { wake: given.wake, sleep: given.sleep });
        else if (beat.kind === 'action') state = answer(state, { action: given.action, actionKind: given.actionKind });
        else if (beat.kind === 'commit') state = ascentReducer(state, { type: 'created', created: { goalId: 'g', stepId: 's', stepKind: 'task' } });
        else if (beat.kind === 'build') state = ascentReducer(state, { type: 'built' });
    }
    throw new Error('The story never reached its end.');
}

const everyone: Answers = {
    name: 'sam', history: 'sometimes', juggling: ['job', 'school'], chronotype: 'early_bird', wake: '06:30', sleep: '22:30',
    sleepAmount: 'seven_eight', phone: 'two_four', age: 'age_18', skill: 'morse', obstacle: 'consistency', timing: 'planned', goal: 'health', action: 'A ten-minute walk', actionKind: 'habit',
    when: 'now', invite: 'later', source: 'friend',
};

describe('the Ascent story', () => {
    it('opens in the dark, and names the Abyss only once they have felt it', () => {
        const start = toWait(initialAscent());
        expect(SCENES[start.scene].id).toBe('abyss');
        expect(currentBeat(start)).toMatchObject({ kind: 'choice', field: 'history' });
        const replies = (['always', 'sometimes', 'rarely'] as const).map(history => (currentBeat(answer(start, { history })) as { text: string }).text);
        expect(new Set(replies).size).toBe(3);
        replies.forEach(text => { expect(text).toMatch(/Abyss/); expect(text.toLowerCase()).not.toMatch(/fail/); });
    });

    it('meets Echo, a ripple in time, and asks a name, which can be skipped', () => {
        const state = toWait(at('echo'));
        expect(lineOf(state)).toBe('Who am I talking to?');
        expect(currentBeat(state)).toMatchObject({ kind: 'input', field: 'name', optional: true });
        expect(currentBeat(answer(state, { name: 'sam peter' }))).toMatchObject({ text: 'Sam. Let’s get you out of here.' });
        expect(currentBeat(answer(state, { name: '' }))).toMatchObject({ text: 'A mystery. Let’s get you out anyway.' });
    });

    it('shows time as a 24-hour day, then asks their rhythm and their sleep', () => {
        let day = toWait(at('chronos'));
        expect(stageOf(day)).toBe('clock');
        expect(currentBeat(day)?.kind).toBe('day');
        day = toWait(answer(day, { wake: '09:00', sleep: '01:00' }));
        expect(currentBeat(day)).toMatchObject({ kind: 'choice', field: 'chronotype' });
        day = toWait(answer(day, { chronotype: 'night_owl' }));
        expect(currentBeat(day)).toMatchObject({ kind: 'choice', field: 'sleepAmount' });
        expect(currentBeat(answer(day, { sleepAmount: 'under_six' }))).toMatchObject({ text: 'We’ll work on that. Everything’s harder tired.' });
    });

    it('works out the years a screen takes from their own hours and age, and shows them as a life', () => {
        expect(screenYears({ phone: 'two_four', age: 'age_18' })).toMatchObject({ hours: 3, years: 7.4, left: 59 });
        expect(yearsLabel(0.4)).toBe('5 months');
        let cost = toWait(at('cost'));
        cost = toWait(answer(cost, { phone: 'two_four' }));
        const shown = answer(cost, { age: 'age_18' });
        expect(currentBeat(shown)).toMatchObject({ text: '3 hours a day until 80 is 7.4 years. On a screen.' });
        expect(stageOf(shown)).toBe('lifetime');
    });

    it('trades the same thirty minutes for the skill they picked', () => {
        const trade = answer(toWait(at('trade')), { skill: 'morse' });
        expect(currentBeat(trade)).toMatchObject({ text: 'In about 90 days, you could read and send Morse code.' });
        expect(stageOf(trade)).toBe('trade');
        expect(goalTitle({ goal: 'skill', skill: 'morse' })).toBe('Learn Morse code');
    });

    it('draws motivation, then discipline over it, then the compounding, around what gets in their way', () => {
        const opening = at('compound');
        expect(stageOf(opening)).toBe('motivation');
        expect(stageOf(tap(opening))).toBe('discipline');
        const obstacle = toWait(opening);
        expect(currentBeat(obstacle)).toMatchObject({ kind: 'choice', field: 'obstacle' });
        const lines = (['starting', 'consistency', 'distraction', 'overwhelm'] as const).map(id => (currentBeat(answer(obstacle, { obstacle: id })) as { text: string }).text);
        expect(new Set(lines).size).toBe(4);
        expect(stageOf(tap(answer(obstacle, { obstacle: 'starting' })))).toBe('compound');
        expect(COMPOUND.better).toBe(37.8);
        expect(suggestions({ obstacle: 'distraction' })[0].kind).toBe('focus');
        expect(suggestions({ obstacle: 'consistency', goal: 'health' })[0]).toMatchObject({ kind: 'habit', label: 'A ten-minute walk' });
    });

    it('asks the goal as choices, with something else in their own words', () => {
        const goal = toWait(at('goal'));
        expect(currentBeat(goal)).toMatchObject({ kind: 'choice', field: 'goal', own: { field: 'goalText' } });
        expect(currentBeat(answer(goal, { goal: 'health' }))).toMatchObject({ kind: 'line', text: 'Get fitter and healthier. Let’s make it real.' });
        expect(currentBeat(answer(goal, { goal: 'own', goalText: 'finish my degree' }))).toMatchObject({ text: 'Finish my degree. Let’s make it real.' });
    });

    it('cannot be tapped past an answer, the save or the build', () => {
        const name = toWait(initialAscent());
        expect(tap(name)).toBe(name);
        let foothold = toWait(at('foothold'));
        expect(tap(foothold)).toBe(foothold);
        foothold = toWait(answer(foothold, { action: 'A ten-minute walk', actionKind: 'habit' }));
        foothold = answer(foothold, { when: 'now' });
        expect(currentBeat(foothold)?.kind).toBe('commit');
        expect(lineOf(foothold)).toBeNull();
        expect(tap(foothold)).toBe(foothold);
        expect(answer(foothold, { when: 'later' })).toBe(foothold);
        expect(ascentReducer(foothold, { type: 'built' })).toBe(foothold);
        const made = ascentReducer(foothold, { type: 'created', created: { goalId: 'g', stepId: 's', stepKind: 'habit' } });
        expect(currentBeat(made)).toMatchObject({ text: 'Done. That’s your first step.' });
    });

    it('keeps Echo brief: a few lines between answers, never a speech', () => {
        SCENES.forEach(scene => {
            let run = 0;
            scene.beats(everyone).forEach(beat => {
                run = beat.kind === 'line' ? run + 1 : 0;
                expect(run).toBeLessThanOrEqual(3);
                if (beat.kind === 'line') expect(beat.text.length).toBeLessThanOrEqual(80);
            });
        });
    });

    it('plays start to finish, ending on Echo built for them and the hold to rise', () => {
        const end = play(everyone);
        expect(SCENES[end.scene].id).toBe('your-echo');
        expect(currentBeat(end)?.kind).toBe('begin');
        expect(end.answers).toMatchObject({ source: 'friend', juggling: ['job', 'school'], wake: '06:30' });
        expect(end.created).toEqual({ goalId: 'g', stepId: 's', stepKind: 'task' });
        expect(progressOf(ascentReducer(end, { type: 'finish' }))).toBe(1);
    });
});

describe('their Echo', () => {
    it('is gentle with someone overwhelmed or running on empty, firm with someone who leaves it to the deadline', () => {
        expect(buildEcho({ obstacle: 'overwhelm', timing: 'last_minute' }).voice).toBe('friendly');
        expect(buildEcho({ obstacle: 'starting', sleepAmount: 'under_six' }).voice).toBe('friendly');
        expect(buildEcho({ obstacle: 'starting', timing: 'last_minute' }).voice).toBe('dad_mode');
        expect(buildEcho({ obstacle: 'distraction', timing: 'straight_away' }).voice).toBe('normal');
    });

    it('turns on the nudges that answer what they said, and keeps demon mode away from the gentle', () => {
        expect(buildEcho({ obstacle: 'consistency', timing: 'planned' }).config).toMatchObject({ morning: true, evening: true, alive: false });
        expect(buildEcho({ obstacle: 'distraction', timing: 'planned' }).config).toMatchObject({ evening: false, alive: true });
        expect(buildEcho({ obstacle: 'overwhelm' }).config.demonMode).toBe(false);
        expect(buildEcho({ obstacle: 'starting', timing: 'last_minute' }).config.demonMode).toBe(true);
    });

    it('keeps their hours, or the ones their rhythm suggests', () => {
        expect(buildEcho({ wake: '06:30', sleep: '22:30' }).day).toEqual({ wake: '06:30', sleep: '22:30' });
        expect(buildEcho({ chronotype: 'night_owl' }).day).toEqual({ wake: '09:00', sleep: '01:00' });
        expect(buildEcho(everyone).parts).toHaveLength(3);
    });
});

describe('the first step', () => {
    it('is dated for when they chose', () => {
        const now = new Date('2026-10-28T10:02:00');
        expect(whenOf('now', now)).toEqual({ date: '2026-10-28', time: '10:05' });
        expect(whenOf('later', now)).toEqual({ date: '2026-10-28', time: '18:00' });
        expect(whenOf('tomorrow', now)).toEqual({ date: '2026-10-29', time: '09:00' });
    });
    it('keeps what they chose, or their own words', () => {
        expect(stepOf({ obstacle: 'distraction', goal: 'health', action: 'A ten-minute focus session' })).toMatchObject({ kind: 'focus', minutes: 10 });
        expect(stepOf({ action: 'Call my mum', actionKind: 'task' })).toMatchObject({ title: 'Call my mum', kind: 'task' });
    });
});
