import AsyncStorage from '@react-native-async-storage/async-storage';
import { RANKS, rankFor } from './marks';

/**
 * The story's beats, inside the app: your first foothold (the first thing you
 * ever finish) and each new rank you climb to. Each is shown once.
 *
 * A phone that has never kept this state starts from where its person already
 * is, so nobody gets a pile of moments for climbing they did before this.
 */
export type ClimbMoment =
    | { kind: 'foothold' }
    | { kind: 'rankUp'; rank: string; index: number };

export interface ClimbState { rank: number; foothold: boolean }

const KEY = 'habyss_climb_state';

const ECHO_LINES: Record<string, string> = {
    Beginner: 'That’s a start.',
    Growing: 'Look how far down that is.',
    Consistent: 'Same time tomorrow.',
    Disciplined: 'No shortcuts. Good.',
    Focused: 'You can see the others now.',
    Master: 'Don’t look down. Look up.',
    Unbreakable: 'Wind won’t move you now.',
    Timekeeper: 'Almost light.',
    Eternal: 'You’re out. Stay out.',
};

/** Each rank's emblem: what the climb looks like at that height. */
export const RANK_ICONS: Record<string, string> = {
    Lost: 'help', Beginner: 'footsteps', Growing: 'leaf', Consistent: 'repeat', Disciplined: 'shield-checkmark',
    Focused: 'eye', Master: 'star', Unbreakable: 'diamond', Timekeeper: 'hourglass', Eternal: 'infinite',
};

export const echoLineFor = (moment: ClimbMoment): string =>
    moment.kind === 'foothold' ? 'Just one thing. Today. Done.' : ECHO_LINES[moment.rank] ?? 'Keep climbing.';

/** What to show, given what was last seen and where things stand now. */
export function nextMoment(previous: ClimbState | null, marks: number, hasCompleted: boolean): { moment: ClimbMoment | null; state: ClimbState } {
    const index = RANKS.indexOf(rankFor(marks).rank);
    if (!previous) return { moment: null, state: { rank: index, foothold: hasCompleted } };
    if (hasCompleted && !previous.foothold) return { moment: { kind: 'foothold' }, state: { ...previous, foothold: true } };
    if (index > previous.rank) return { moment: { kind: 'rankUp', rank: RANKS[index].name, index }, state: { ...previous, rank: index } };
    // Falling a rank is remembered quietly, so climbing back is a moment again.
    if (index < previous.rank) return { moment: null, state: { ...previous, rank: index } };
    return { moment: null, state: previous };
}

export async function loadClimbState(): Promise<ClimbState | null> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as ClimbState) : null;
    } catch {
        return null;
    }
}

export async function saveClimbState(state: ClimbState): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}
