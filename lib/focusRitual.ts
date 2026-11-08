import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';

/**
 * The hourglass ritual into Focus (components/Focus/FocusPortal.tsx) plays
 * in full once a day, the first time. Every session after that day goes
 * straight to the sand falling away: a ritual seen five times a day is a wait.
 * The day it last played is kept, so reopening the app does not replay it.
 */
const KEY = 'habyss_focus_ritual_day';

let playedOn: string | null = null;
let lastEntryFull = false;
void AsyncStorage.getItem(KEY).then(day => { if (day && !playedOn) playedOn = day; }).catch(() => undefined);

/** Whether this entry gets the full ritual (true once a day), and notes that it has. Pure given `today`. */
export function takeFocusRitual(today = localDateKey(new Date())): boolean {
    lastEntryFull = playedOn !== today;
    if (lastEntryFull) {
        playedOn = today;
        void AsyncStorage.setItem(KEY, today).catch(() => undefined);
    }
    return lastEntryFull;
}

/** Leaving matches how it began: the slow gathering only after the full ritual. */
export const focusExitFull = () => lastEntryFull;
