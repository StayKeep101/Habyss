jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) }));

import { ascentReducer, beatsOf, cuesOf, currentBeat, initialAscent, lineOf, progressOf, type AscentState } from '../ascent/machine';
import { SCENES, goalTitle, suggestions, type Answers } from '../ascent/story';
import { stepOf, whenOf } from '../ascent/plan';

const answer = (state: AscentState, field: keyof Answers, value: string) => ascentReducer(state, { type: 'answer', field, value });
const tap = (state: AscentState) => ascentReducer(state, { type: 'next' });
const sceneId = (state: AscentState) => SCENES[state.scene].id;
/** Taps through lines until the story waits for something. */
const toWait = (state: AscentState) => {
    let next = state;
    for (let guard = 0; guard < 40; guard++) {
        const beat = currentBeat(next);
        if (!beat || beat.kind !== 'line') return next;
        next = tap(next);
    }
    return next;
};

describe('the Ascent story', () => {
    it('opens in the dark with Echo and asks a name, which can be skipped', () => {
        let state = toWait(initialAscent());
        expect(currentBeat(state)).toMatchObject({ kind: 'input', field: 'name', optional: true });
        state = answer(state, 'name', 'erwan peter');
        expect(currentBeat(state)).toMatchObject({ kind: 'line', text: 'Nice to meet you, Erwan.' });
        const skipped = answer(toWait(initialAscent()), 'name', '');
        expect(currentBeat(skipped)).toMatchObject({ text: 'Mysterious. I like it.' });
    });

    it('answers each way of having ended up here differently, and never says you failed', () => {
        const replies = (['always', 'sometimes', 'rarely'] as const).map(id => {
            let state: AscentState = { ...initialAscent(), scene: SCENES.findIndex(scene => scene.id === 'descent') };
            state = answer(toWait(state), 'history', id);
            return (currentBeat(state) as { text: string }).text;
        });
        expect(new Set(replies).size).toBe(3);
        expect(replies.join(' ')).not.toMatch(/fail/i);
    });

    it('gives each obstacle its own line and its own first step', () => {
        const obstacles = ['starting', 'consistency', 'distraction', 'overwhelm'] as const;
        const lines = obstacles.map(id => {
            let state: AscentState = { ...initialAscent(), scene: SCENES.findIndex(scene => scene.id === 'mirror') };
            state = answer(toWait(state), 'obstacle', id);
            return currentBeat(state);
        });
        expect(new Set(lines.map(beat => (beat as { text: string }).text)).size).toBe(4);
        expect(lines.every(beat => beat && 'cue' in beat && beat.cue === 'OBSTACLE_REVEAL')).toBe(true);
        expect(obstacles.map(id => suggestions({ obstacle: id, goal: 'health' })[0].kind)).toEqual(['task', 'habit', 'focus', 'dump']);
    });

    it('asks for the goal in their words only for something important or their own', () => {
        const scene = SCENES.findIndex(item => item.id === 'turning-point');
        const chosen = answer(toWait({ ...initialAscent(), scene }), 'goal', 'health');
        expect(currentBeat(chosen)).toMatchObject({ kind: 'line', cue: 'GOAL_MATERIALIZE' });
        const own = answer(toWait({ ...initialAscent(), scene }), 'goal', 'own');
        expect(currentBeat(own)).toMatchObject({ kind: 'input', field: 'goalText' });
        expect(goalTitle({ goal: 'own', goalText: 'run a marathon' })).toBe('Run a marathon');
        expect(goalTitle({ goal: 'organized' })).toBe('Get my life organized');
    });

    it('cannot be tapped past a choice, the first step or the save', () => {
        const scene = SCENES.findIndex(item => item.id === 'foothold');
        const waiting = toWait({ ...initialAscent(), scene });
        expect(currentBeat(waiting)?.kind).toBe('action');
        expect(tap(waiting)).toBe(waiting);
        const atCommit = answer(toWait(answer(waiting, 'action', 'A ten-minute walk')), 'when', 'now');
        expect(currentBeat(atCommit)?.kind).toBe('commit');
        const saved = ascentReducer(atCommit, { type: 'created', created: { goalId: 'g', stepId: 's', stepKind: 'habit' } });
        expect(currentBeat(saved)).toMatchObject({ cue: 'FIRST_STEP_CREATED' });
    });

    it('ends with the ascent and is finished after it', () => {
        let state: AscentState = { ...initialAscent(), scene: SCENES.length - 1 };
        state = toWait(state);
        expect(currentBeat(state)?.kind).toBe('begin');
        state = ascentReducer(state, { type: 'finish' });
        expect(state.finished).toBe(true);
        expect(progressOf(state)).toBe(1);
        expect(beatsOf(initialAscent()).length).toBeGreaterThan(0);
    });
});

describe('the first step', () => {
    it('is dated for when they chose', () => {
        const at = new Date('2026-10-28T10:02:00');
        expect(whenOf('now', at)).toEqual({ date: '2026-10-28', time: '10:05' });
        expect(whenOf('later', at)).toEqual({ date: '2026-10-28', time: '18:00' });
        expect(whenOf('tomorrow', at)).toEqual({ date: '2026-10-29', time: '09:00' });
    });
    it('keeps what they chose, or their own words', () => {
        expect(stepOf({ obstacle: 'distraction', goal: 'health', action: 'A ten-minute focus session' })).toMatchObject({ kind: 'focus', minutes: 10 });
        expect(stepOf({ action: 'Call my mum', actionKind: 'task' })).toMatchObject({ title: 'Call my mum', kind: 'task' });
    });
});

describe('waiting, and what the world shows', () => {
    const at = (scene: string): AscentState => ({ ...initialAscent(), scene: SCENES.findIndex(item => item.id === scene) });

    it('never taps past words, a choice or the domino', () => {
        const name = toWait(initialAscent());
        expect(tap(name)).toBe(name);
        const domino = toWait(at('domino'));
        expect(currentBeat(domino)?.kind).toBe('touch');
        expect(tap(domino)).toBe(domino);
        const fallen = ascentReducer(domino, { type: 'touched' });
        expect(currentBeat(fallen)).toMatchObject({ kind: 'line', text: 'Not a very big move, was it?' });
        // A touch only counts on the beat that waits for it.
        expect(ascentReducer(fallen, { type: 'touched' })).toBe(fallen);
    });

    it('plays each cue from its line on, and the chain only after the touch', () => {
        const domino = toWait(at('domino'));
        expect(cuesOf(domino).has('DOMINO_READY')).toBe(true);
        expect(cuesOf(domino).has('CHAIN_REACTION')).toBe(false);
        expect(cuesOf(ascentReducer(domino, { type: 'touched' })).has('CHAIN_REACTION')).toBe(true);
        expect(cuesOf(at('descent')).has('CAMERA_DESCEND')).toBe(true);
    });

    it('keeps the question on screen above its answers, and none while saving', () => {
        const name = toWait(initialAscent());
        expect(lineOf(name)).toBe('What should I call you?');
        let foothold = toWait(at('foothold'));
        foothold = ascentReducer(foothold, { type: 'answer', field: 'action', value: 'A ten-minute walk', also: { actionKind: 'habit' } });
        expect(foothold.answers.actionKind).toBe('habit');
        foothold = answer(toWait(foothold), 'when', 'now');
        expect(currentBeat(foothold)?.kind).toBe('commit');
        expect(lineOf(foothold)).toBeNull();
        expect(tap(foothold)).toBe(foothold);
        const made = ascentReducer(foothold, { type: 'created', created: { goalId: 'g', stepId: 's', stepKind: 'habit' } });
        expect(currentBeat(made)).toMatchObject({ text: 'There. Your first step.' });
        expect(cuesOf(made).has('FIRST_STEP_CREATED')).toBe(true);
    });
});
