jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) }));

import { ascentReducer, currentBeat, initialAscent, lineOf, progressOf, stageOf, type AscentState } from '../ascent/machine';
import { COMPOUND, SCENES, awakeHours, goalTitle, screenTime, suggestions, type Answers } from '../ascent/story';
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
        else if (beat.kind === 'number') state = answer(state, { age: given.age });
        else if (beat.kind === 'day') state = answer(state, { wake: given.wake, sleep: given.sleep });
        else if (beat.kind === 'action') state = answer(state, { action: given.action, actionKind: given.actionKind });
        else if (beat.kind === 'commit') state = ascentReducer(state, { type: 'created', created: { goalId: 'g', stepId: 's', stepKind: 'task' } });
        else if (beat.kind === 'build') state = ascentReducer(state, { type: 'built' });
    }
    throw new Error('The story never reached its end.');
}

const everyone: Answers = {
    name: 'sam', history: 'sometimes', juggling: ['job', 'school'], chronotype: 'early_bird', wake: '06:30', sleep: '22:30',
    sleepAmount: 'seven_eight', phone: 'h4', age: 19, skill: 'morse', obstacle: 'consistency', timing: 'planned', goal: 'health', action: 'A ten-minute walk', actionKind: 'habit',
    when: 'now', invite: 'later', source: 'friend',
};

describe('the Ascent story', () => {
    it('opens in the dark, and names the Abyss only once they have felt it', () => {
        const start = toWait(initialAscent());
        expect(SCENES[start.scene].id).toBe('abyss');
        expect(currentBeat(start)).toMatchObject({ kind: 'choice', field: 'history' });
        const replies = (['always', 'sometimes', 'rarely'] as const).map(history => (currentBeat(answer(start, { history })) as { text: string }).text);
        expect(new Set(replies).size).toBe(3);
        replies.forEach(text => expect(text.toLowerCase()).not.toMatch(/fail/));
        expect((currentBeat(tap(answer(start, { history: 'always' }))) as { text: string }).text).toMatch(/^The Abyss\./);
    });

    it('meets Echo, a ripple in time, and asks a name, which can be skipped', () => {
        const state = toWait(at('echo'));
        expect(lineOf(state)).toBe('Before we climb, what should I call you?');
        expect(currentBeat(state)).toMatchObject({ kind: 'input', field: 'name', optional: true });
        expect(currentBeat(answer(state, { name: 'sam peter' }))).toMatchObject({ text: 'Sam. I like that.' });
        expect(currentBeat(tap(answer(state, { name: 'sam' })))).toMatchObject({ text: 'Alright, Sam. Let me show you how this place works.' });
        expect(currentBeat(answer(state, { name: '' }))).toMatchObject({ text: 'No name? A mystery. I like that too.' });
    });

    it('builds time up as a 24-hour day, everyone’s, then theirs', () => {
        let day = at('chronos');
        expect(stageOf(day)).toEqual({ stage: 'clock', step: 0 });
        expect(stageOf(tap(tap(day)))).toEqual({ stage: 'clock', step: 1 });
        day = toWait(day);
        expect(currentBeat(day)?.kind).toBe('day');
        const answered = answer(day, { wake: '07:00', sleep: '23:00' });
        expect(currentBeat(answered)).toMatchObject({ text: '16 hours awake. That’s what you get to spend, every day.' });
        expect(stageOf(answered)).toEqual({ stage: 'clock', step: 2 });
        expect(awakeHours({ wake: '09:00', sleep: '01:00' })).toBe(16);
        const owl = answer(toWait(answered), { chronotype: 'night_owl' });
        expect(currentBeat(owl)).toMatchObject({ text: 'A night owl. I’ll keep your mornings gentle.' });
    });

    it('works out the time a screen has taken and will take, from their own hours and age', () => {
        // 4 h × 365 × 19 = 27,740 hours = 1,156 days = 3.17 years; to 90, 71 more years at 4 h is 11.8.
        expect(screenTime({ phone: 'h4', age: 19 })).toMatchObject({ hours: 27740, days: 1156, years: 3.17, left: 71, ahead: 11.8 });
        let cost = toWait(at('cost'));
        cost = toWait(answer(cost, { phone: 'h4' }));
        expect(currentBeat(cost)).toMatchObject({ kind: 'number', field: 'age' });
        let shown = answer(cost, { age: 19 });
        expect(stageOf(shown)).toEqual({ stage: 'cost', step: 0 });
        const said: string[] = [];
        for (let i = 0; i < 5; i++) { said.push((currentBeat(shown) as { text: string }).text); shown = tap(shown); }
        expect(said).toEqual([
            'Let’s do the math together.',
            '4 hours a day, 365 days a year, for 19 years.',
            'That’s 27,740 hours. 1,156 days.',
            '3.17 years of your life. Already gone.',
            'Now picture a whole life. About 90 years, one cube each.',
        ]);
        expect(currentBeat(shown)).toMatchObject({ text: 'Keep going like this, and 11.8 more years go to a screen.' });
        expect(stageOf(shown)).toEqual({ stage: 'cost', step: 4 });
    });

    it('trades the same thirty minutes for the skill they picked', () => {
        const trade = answer(toWait(at('trade')), { skill: 'morse' });
        expect(stageOf(trade)).toEqual({ stage: 'trade', step: 0 });
        expect(currentBeat(tap(tap(trade)))).toMatchObject({ text: 'Scrolling leaves nothing behind. Morse code? You could read and send Morse code.' });
        expect(goalTitle({ goal: 'skill', skill: 'morse' })).toBe('Learn Morse code');
    });

    it('draws motivation, then discipline over it, then the compounding, around what gets in their way', () => {
        const opening = tap(at('compound'));
        expect(stageOf(opening)).toEqual({ stage: 'motivation', step: 0 });
        expect(stageOf(tap(opening))).toEqual({ stage: 'motivation', step: 1 });
        const obstacle = toWait(opening);
        expect(currentBeat(obstacle)).toMatchObject({ kind: 'choice', field: 'obstacle' });
        const lines = (['starting', 'consistency', 'distraction', 'overwhelm'] as const).map(id => (currentBeat(answer(obstacle, { obstacle: id })) as { text: string }).text);
        expect(new Set(lines).size).toBe(4);
        expect(stageOf(tap(answer(obstacle, { obstacle: 'starting' })))).toEqual({ stage: 'compound', step: 0 });
        expect(COMPOUND.better).toBe(37.8);
        expect(suggestions({ obstacle: 'distraction' })[0].kind).toBe('focus');
        expect(suggestions({ obstacle: 'consistency', goal: 'health' })[0]).toMatchObject({ kind: 'habit', label: 'A ten-minute walk' });
    });

    it('asks the goal as choices, with something else in their own words', () => {
        const goal = toWait(at('goal'));
        expect(currentBeat(goal)).toMatchObject({ kind: 'choice', field: 'goal', own: { field: 'goalText' } });
        expect(currentBeat(answer(goal, { goal: 'health' }))).toMatchObject({ kind: 'line', text: 'Get fitter and healthier. Let’s make that real, one small step at a time.' });
        expect(currentBeat(answer(goal, { goal: 'own', goalText: 'finish my degree' }))).toMatchObject({ text: 'Finish my degree. Let’s make that real, one small step at a time.' });
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
        expect(currentBeat(made)).toMatchObject({ text: 'Done. That’s your first step, and it’s on your plan.' });
    });

    it('keeps Echo’s lines short, and asks something at least every few lines', () => {
        SCENES.forEach(scene => {
            let run = 0;
            scene.beats(everyone).forEach(beat => {
                // Lines that narrate a slide are the film itself; the rest is talk, and a question comes soon.
                run = beat.kind !== 'line' ? 0 : beat.stage ? run : run + 1;
                expect(run).toBeLessThanOrEqual(4);
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
