import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCENES, type Answers, type Beat, type Cue } from './story';

/**
 * Walks the story (lib/ascent/story.ts): which scene, which beat, and what
 * has been answered. A pure reducer, so every branch can be tested, saved
 * after every step so the app can be closed mid-story and pick up where it
 * was. What the world shows is never in here: only where the story is.
 */
export interface AscentState {
    scene: number;
    beat: number;
    answers: Answers;
    /** Saved once (lib/ascent/plan.ts): what the commit beat created, so it is never created twice. */
    created?: { goalId: string; stepId: string; stepKind: 'task' | 'habit' };
    finished: boolean;
    version: 1;
}

export type AscentAction =
    | { type: 'next' }
    | { type: 'answer'; field: keyof Answers; value: string | undefined; also?: Partial<Answers> }
    /** The touch a scene waited for (the first domino) has happened. */
    | { type: 'touched' }
    | { type: 'created'; created: NonNullable<AscentState['created']> }
    | { type: 'finish' };

export const initialAscent = (): AscentState => ({ scene: 0, beat: 0, answers: {}, finished: false, version: 1 });

/** The beats of the current scene, for what has been answered so far. */
export const beatsOf = (state: AscentState): Beat[] => SCENES[state.scene]?.beats(state.answers) ?? [];
export const currentBeat = (state: AscentState): Beat | null => beatsOf(state)[state.beat] ?? null;

/** One step on: the next beat, or the next scene's first, or the end. */
function step(state: AscentState): AscentState {
    if (state.beat + 1 < beatsOf(state).length) return { ...state, beat: state.beat + 1 };
    if (state.scene + 1 < SCENES.length) return { ...state, scene: state.scene + 1, beat: 0 };
    return { ...state, finished: true };
}

export function ascentReducer(state: AscentState, action: AscentAction): AscentState {
    switch (action.type) {
        case 'next': {
            const beat = currentBeat(state);
            // A beat that waits for something (words, a choice, a touch, the save) cannot be tapped past.
            if (beat && beat.kind !== 'line') return state;
            return step(state);
        }
        case 'answer': {
            const answers = { ...state.answers, ...action.also, [action.field]: action.value };
            return step({ ...state, answers });
        }
        case 'touched':
            return currentBeat(state)?.kind === 'touch' ? step(state) : state;
        case 'created':
            return step({ ...state, created: action.created });
        case 'finish':
            return { ...state, finished: true };
        default:
            return state;
    }
}

/**
 * What the world has shown so far in this scene: the scene's own cue, every
 * line's cue up to the one on screen, and a touch's cue once it is done.
 * Derived from where the story is, never kept, so a resume shows the same.
 */
export function cuesOf(state: AscentState): Set<Cue> {
    const cues = new Set<Cue>();
    const scene = SCENES[state.scene];
    if (scene?.cue) cues.add(scene.cue);
    beatsOf(state).forEach((beat, index) => {
        if (beat.kind === 'line' && beat.cue && index <= state.beat) cues.add(beat.cue);
        if (beat.kind === 'touch' && index < state.beat) cues.add(beat.cue);
    });
    return cues;
}

/** The line shown for a beat: its own, or the question still standing above a choice. None while saving. */
export function lineOf(state: AscentState): string | null {
    const beats = beatsOf(state);
    if (beats[state.beat]?.kind === 'commit') return null;
    for (let index = state.beat; index >= 0; index--) {
        const beat = beats[index];
        if (beat?.kind === 'line') return beat.text;
    }
    return null;
}

/** How far through, 0 to 1, for the progress hint and VoiceOver. */
export const progressOf = (state: AscentState): number =>
    state.finished ? 1 : Math.min(1, (state.scene + state.beat / Math.max(1, beatsOf(state).length)) / SCENES.length);

const KEY = 'habyss_ascent';

export async function loadAscent(): Promise<AscentState | null> {
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
        if (raw && raw.version === 1 && typeof raw.scene === 'number' && raw.answers) {
            // Resume at the start of the scene it was in: a beat mid-scene may depend on a moment that has passed.
            const scene = Math.min(raw.scene, SCENES.length - 1);
            return { ...raw, scene, beat: 0 };
        }
    } catch { /* start fresh */ }
    return null;
}

export async function saveAscent(state: AscentState): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}

export async function clearAscent(): Promise<void> {
    await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
