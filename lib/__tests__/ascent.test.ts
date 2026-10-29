jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) }));

import { ascentReducer, currentBeat, initialAscent, lineOf, progressOf, type AscentState } from '../ascent/machine';
import { SCENES, goalTitle, suggestions, type Answers } from '../ascent/story';
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
        else if (beat.kind === 'input') state = answer(state, { [beat.field]: given[beat.field] ?? '' });
        else if (beat.kind === 'day') state = answer(state, { wake: given.wake, sleep: given.sleep });
        else if (beat.kind === 'action') state = answer(state, { action: given.action, actionKind: given.actionKind });
        else if (beat.kind === 'commit') state = ascentReducer(state, { type: 'created', created: { goalId: 'g', stepId: 's', stepKind: 'task' } });
        else if (beat.kind === 'build') state = ascentReducer(state, { type: 'built' });
    }
    throw new Error('The story never reached its end.');
}

const everyone: Answers = {
    name: 'sam', history: 'sometimes', juggling: ['job', 'school'], chronotype: 'early_bird', wake: '06:30', sleep: '22:30',
    sleepAmount: 'seven_eight', obstacle: 'consistency', timing: 'planned', goal: 'health', action: 'A ten-minute walk', actionKind: 'habit',
    when: 'now', invite: 'later', source: 'friend',
};

describe('the Ascent story', () => {
    it('meets Echo and asks a name, which can be skipped', () => {
        const state = toWait(initialAscent());
        expect(currentBeat(state)).toMatchObject({ kind: 'input', field: 'name', optional: true });
        expect(currentBeat(answer(state, { name: 'sam peter' }))).toMatchObject({ text: 'Sam. Good to meet you.' });
        expect(currentBeat(answer(state, { name: '' }))).toMatchObject({ text: 'A mystery. Fair enough.' });
    });

    it('answers each way of having ended up here differently, and never says you failed', () => {
        const replies = (['always', 'sometimes', 'rarely'] as const).map(history => (currentBeat(answer(toWait(at('history')), { history })) as { text: string }).text);
        expect(new Set(replies).size).toBe(3);
        replies.forEach(text => expect(text.toLowerCase()).not.toMatch(/fail/));
    });

    it('asks what they juggle, their rhythm, their hours and their sleep', () => {
        const life = toWait(at('life'));
        expect(currentBeat(life)).toMatchObject({ kind: 'multi', field: 'juggling' });
        expect(currentBeat(answer(life, { juggling: ['job', 'school', 'family'] }))).toMatchObject({ text: 'That’s a lot. We’ll guard time for what matters.' });

        let rhythm = toWait(at('rhythm'));
        expect(currentBeat(rhythm)).toMatchObject({ kind: 'choice', field: 'chronotype' });
        rhythm = toWait(answer(rhythm, { chronotype: 'night_owl' }));
        expect(currentBeat(rhythm)?.kind).toBe('day');
        rhythm = toWait(answer(rhythm, { wake: '09:00', sleep: '01:00' }));
        expect(currentBeat(rhythm)).toMatchObject({ kind: 'choice', field: 'sleepAmount' });
        expect(currentBeat(answer(rhythm, { sleepAmount: 'under_six' }))).toMatchObject({ text: 'Let’s work on that. Everything’s harder tired.' });
    });

    it('gives each obstacle its own line and its own first step', () => {
        const lines = (['starting', 'consistency', 'distraction', 'overwhelm'] as const).map(obstacle => (currentBeat(answer(toWait(at('mirror')), { obstacle })) as { text: string }).text);
        expect(new Set(lines).size).toBe(4);
        expect(suggestions({ obstacle: 'distraction' })[0].kind).toBe('focus');
        expect(suggestions({ obstacle: 'consistency', goal: 'health' })[0]).toMatchObject({ kind: 'habit', label: 'A ten-minute walk' });
    });

    it('asks for the goal in their words only for something important or their own', () => {
        const goal = toWait(at('goal'));
        expect(currentBeat(answer(goal, { goal: 'health' }))).toMatchObject({ kind: 'line', text: 'Improve my health. Let’s do it.' });
        expect(currentBeat(answer(goal, { goal: 'own' }))).toMatchObject({ kind: 'input', field: 'goalText' });
        expect(goalTitle({ goal: 'achieve', goalText: 'finish my degree' })).toBe('Finish my degree');
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

    it('keeps Echo brief: a line or two between each answer, never a speech', () => {
        SCENES.forEach(scene => {
            let run = 0;
            scene.beats(everyone).forEach(beat => {
                run = beat.kind === 'line' ? run + 1 : 0;
                expect(run).toBeLessThanOrEqual(2);
                if (beat.kind === 'line') expect(beat.text.length).toBeLessThanOrEqual(80);
            });
        });
    });

    it('plays start to finish, ending on Echo built for them and the last button', () => {
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
