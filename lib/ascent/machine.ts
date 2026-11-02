import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCENES, type Answers, type Beat, type StageId } from './story';

/**
 * Walks the story (lib/ascent/story.ts): which scene, which beat, and what
 * has been answered. A pure reducer, so every branch can be tested, saved
 * after every step so the app can be closed mid-story and pick up where it
 * was. What is drawn is never in here: only where the story is.
 */
export interface AscentState {
    scene: number;
    beat: number;
    answers: Answers;
    /** Saved once (lib/ascent/plan.ts): what the commit beat created, so it is never created twice. */
    created?: { goalId: string; stepId: string; stepKind: 'task' | 'habit' };
    finished: boolean;
    version: 4;
}

export type AscentAction =
    | { type: 'next' }
    /** An answer given: the beat waiting for it moves on. */
    | { type: 'answer'; patch: Partial<Answers> }
    | { type: 'created'; created: NonNullable<AscentState['created']> }
    /** Their Echo has been built and saved. */
    | { type: 'built' }
    | { type: 'finish' };

export const initialAscent = (): AscentState => ({ scene: 0, beat: 0, answers: {}, finished: false, version: 4 });

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
    const kind = currentBeat(state)?.kind;
    switch (action.type) {
        case 'next':
            // Only a line is tapped past; everything else waits for its answer, or the save.
            return kind === 'line' ? step(state) : state;
        case 'answer':
            return kind === 'line' || kind === 'commit' || kind === 'build' ? state : step({ ...state, answers: { ...state.answers, ...action.patch } });
        case 'created':
            return kind === 'commit' ? step({ ...state, created: action.created }) : state;
        case 'built':
            return kind === 'build' ? step(state) : state;
        case 'finish':
            return { ...state, finished: true };
        default:
            return state;
    }
}

/** The line shown for a beat: its own, or the question still standing above an answer. None while saving. */
export function lineOf(state: AscentState): string | null {
    const beats = beatsOf(state);
    const kind = beats[state.beat]?.kind;
    if (kind === 'commit' || kind === 'build') return null;
    for (let index = state.beat; index >= 0; index--) {
        const beat = beats[index];
        if (beat?.kind === 'line') return beat.text;
    }
    return null;
}

/** What Echo is on screen, and how far that slide has got: the last stage set in this scene, up to this beat; itself by default. */
export function stageOf(state: AscentState): { stage: StageId; step: number } {
    const beats = beatsOf(state);
    for (let index = state.beat; index >= 0; index--) {
        const beat = beats[index];
        if (beat?.kind === 'line' && beat.stage) return { stage: beat.stage, step: beat.step ?? 0 };
    }
    return { stage: 'echo', step: 0 };
}

/** How far through, 0 to 1, for the progress line and VoiceOver. */
export const progressOf = (state: AscentState): number =>
    state.finished ? 1 : Math.min(1, (state.scene + state.beat / Math.max(1, beatsOf(state).length)) / SCENES.length);

const KEY = 'habyss_ascent';

export async function loadAscent(): Promise<AscentState | null> {
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
        if (raw && raw.version === 4 && typeof raw.scene === 'number' && raw.answers) {
            // Resume at the start of the scene it was in: a beat mid-scene may depend on a moment that has passed.
            return { ...raw, scene: Math.min(raw.scene, SCENES.length - 1), beat: 0 };
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
