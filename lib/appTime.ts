import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

/**
 * Habits that tick themselves from time in chosen apps (AppTime in
 * ios/Gate/GateShared.swift): "Read" after 20 minutes in Kindle or Books,
 * "Less social media" kept when the day ends under an hour in the social
 * apps. Screen Time's app choices belong to this iPhone, so the link lives
 * on this phone too: { habitId: minutes }.
 *
 * The monitor extension records and says what happened while Habyss is
 * closed; `drainAppTime` turns those records into ticks when it runs.
 */
const KEY = 'habyss_app_time';
const native = (): any => (Platform.OS === 'ios' ? NativeModules.ScreenTimeModule : null);

/** Needs the build with app-time habits in it. */
export const appTimeSupported = (): boolean => typeof native()?.pickAppTimeApps === 'function';

export interface AppTimeIdea {
    id: string;
    name: string;
    icon: string;
    detail: string;
    /** Breaking it: kept under the time, lost over it. */
    quit: boolean;
    minutes: number;
    choices: readonly number[];
    /** Over the app picker. */
    pick: string;
}

export const APP_TIME_IDEAS: AppTimeIdea[] = [
    { id: 'read', name: 'Read', icon: 'book', detail: 'Ticks itself after this long in Kindle, Books or any reading app', quit: false, minutes: 20, choices: [10, 15, 20, 30, 45, 60], pick: 'Reading apps' },
    { id: 'language', name: 'Practise a language', icon: 'language', detail: 'Ticks itself after this long in Duolingo or any language app', quit: false, minutes: 10, choices: [5, 10, 15, 20, 30], pick: 'Language apps' },
    { id: 'learn', name: 'Learn something', icon: 'school', detail: 'Ticks itself after this long in the apps you learn with', quit: false, minutes: 20, choices: [10, 15, 20, 30, 45, 60], pick: 'Learning apps' },
    { id: 'social', name: 'Less social media', icon: 'phone-portrait', detail: 'Kept when the day ends under this. Lost the moment you go over', quit: true, minutes: 60, choices: [15, 30, 45, 60, 90, 120], pick: 'Social apps' },
    { id: 'games', name: 'Fewer games', icon: 'game-controller', detail: 'Kept when the day ends under this. Lost the moment you go over', quit: true, minutes: 30, choices: [15, 30, 45, 60, 90], pick: 'Games' },
];

export async function getAppTime(): Promise<Record<string, number>> {
    try { return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}'); } catch { return {}; }
}

/** The apps that count for this habit: how many were chosen, or -1 when closed without saving. */
export async function chooseApps(habitId: string, title: string): Promise<number> {
    if (!appTimeSupported()) return -1;
    try { return Number(await native().pickAppTimeApps(habitId, title)); } catch { return -1; }
}

/** Links a habit to its apps for `minutes` a day (null unlinks it), and restarts the watch. */
export async function setAppTime(habitId: string, minutes: number | null): Promise<void> {
    const all = await getAppTime();
    if (minutes && minutes > 0) all[habitId] = Math.round(minutes); else delete all[habitId];
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
    await pushAppTime();
}

/** Hands the watched habits to iOS: name and whether it is being broken come from the habit itself. */
export async function pushAppTime(): Promise<void> {
    if (!appTimeSupported()) return;
    const all = await getAppTime();
    const { getHabits }: typeof import('./habitsSQLite') = require('./habitsSQLite');
    const habits = (await getHabits()).filter(habit => all[habit.id] && !habit.isArchived && !habit.isGoal);
    native().setAppTimeHabits(JSON.stringify(habits.map(habit => ({ id: habit.id, name: habit.name, minutes: all[habit.id], quit: habit.type === 'quit' }))));
}

/**
 * What the monitor recorded while Habyss was closed: "done" (reached) and
 * "kept" (a day under) become ticks for that day; "over" is left unticked.
 * The monitor already said each one, so nothing more is sent.
 */
export async function drainAppTime(): Promise<number> {
    if (!appTimeSupported() || typeof native()?.takeAppTimeResults !== 'function') return 0;
    let results: string[] = [];
    try { results = await native().takeAppTimeResults(); } catch { return 0; }
    const { autoTickHabit }: typeof import('./autoTrack') = require('./autoTrack');
    let ticked = 0;
    for (const line of results ?? []) {
        const [habitId, day, outcome] = String(line).split('|');
        if (!habitId || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') || (outcome !== 'done' && outcome !== 'kept')) continue;
        if ((await autoTickHabit(habitId, day)).result === 'done') ticked++;
    }
    return ticked;
}
