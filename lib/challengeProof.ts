import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { on } from './appEvents';
import type { Habit } from './habitsSQLite';

/**
 * Proof, for challenges and bets. Everything else is ticked on your word,
 * and a habit ticked by hand opens the camera for a photo you can skip
 * (kept in its history and shown to friends, lib/tickPhotos.ts).
 *
 *   - A habit or task a challenge put in your plan (lib/challenges.ts).
 *   - A habit or task of a goal you opened to bets (lib/market.ts).
 *
 * Tracked by itself (Apple Health, or the focus timer): it ticks itself, so a
 * tick by hand is not taken; Health fills it, or the timer does when the time
 * is done. Anything else: being at its place (its location reminder) proves
 * it, or a photo taken there and then in Habyss's own camera (no gallery).
 * Unticking never needs proof.
 */

export type ProofItem =
    | { kind: 'habit'; habit: Pick<Habit, 'id' | 'name' | 'goalId' | 'locationReminders' | 'healthKitMetric' | 'unit'> }
    | { kind: 'task'; task: { id: string; title: string; goalId?: string | null } };

export type ProofRule = 'none' | 'health' | 'focus' | 'photo';

const TIMED_UNITS = ['minutes', 'minute', 'min', 'hours', 'hour', 'h', 'seconds'];

/**
 * What a tick by hand needs. `challenge`: the proof a challenge gave the item,
 * if it is one of a challenge's; `staked`: your goals open to bets. Pure.
 */
export function proofRule(item: ProofItem, challenge: 'health' | 'focus' | 'photo' | null, staked: string[]): ProofRule {
    if (challenge) return challenge;
    const goalId = item.kind === 'habit' ? item.habit.goalId : item.task.goalId;
    if (!goalId || !staked.includes(goalId)) return 'none';
    if (item.kind === 'habit' && item.habit.healthKitMetric) return 'health';
    if (item.kind === 'habit' && TIMED_UNITS.includes((item.habit.unit ?? '').trim().toLowerCase())) return 'focus';
    return 'photo';
}

/** Metres between two points (haversine). Pure. */
export function metresBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** A little room for GPS drift beyond the place's own radius. */
export const PLACE_RADIUS = 150;

/** Whether `here` is at one of the places. Pure. */
export function atPlace(here: { latitude: number; longitude: number }, places: { latitude: number; longitude: number; radius?: number }[]): boolean {
    return places.some(place => metresBetween(here, place) <= Math.max(PLACE_RADIUS, place.radius ?? 0));
}

// ---------------------------------------------------- your goals open to bets

const STAKED_KEY = 'habyss_staked_goals';
let staked: string[] = [];
let stakedLoaded = false;

async function loadStaked(): Promise<string[]> {
    if (stakedLoaded) return staked;
    stakedLoaded = true;
    try { staked = JSON.parse((await AsyncStorage.getItem(STAKED_KEY)) ?? '[]') ?? []; } catch { staked = []; }
    return staked;
}

async function refreshStaked(): Promise<void> {
    try {
        const { marketFeed } = require('./market') as typeof import('./market');
        staked = (await marketFeed()).filter(market => market.mine && market.status === 'open').map(market => market.goalKey);
        stakedLoaded = true;
        await AsyncStorage.setItem(STAKED_KEY, JSON.stringify(staked)).catch(() => undefined);
    } catch { /* kept as it was */ }
}

/** Keeps the bets and challenges current: on launch, and whenever one changes or something is ticked. */
export function watchProof(): () => void {
    const { syncChallenges } = require('./challenges') as typeof import('./challenges');
    void loadStaked().then(refreshStaked);
    void syncChallenges();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => { void syncChallenges(); }, 1500); };
    const subs = [
        on('market_changed', () => { void refreshStaked(); soon(); }),
        on('habit_completion_updated', soon),
        on('tasks_changed', soon),
    ];
    return () => { clearTimeout(timer); subs.forEach(sub => sub.remove()); };
}

/** What a tick by hand of this item needs, from what is on this phone. */
export async function ruleFor(item: ProofItem): Promise<{ rule: ProofRule; runId: string | null }> {
    const { loadLinks, challengeOf } = require('./challenges') as typeof import('./challenges');
    await Promise.all([loadLinks(), loadStaked()]);
    const id = item.kind === 'habit' ? item.habit.id : item.task.id;
    const challenge = challengeOf(item.kind, id);
    return { rule: proofRule(item, challenge?.proof ?? null, staked), runId: challenge?.runId ?? null };
}

// ------------------------------------------------------------------ the tick

/** The camera, opened by components/Proof/ProofCameraHost.tsx: resolves with the photo, or null when closed. */
type PhotoAsk = { title: string; resolve: (uri: string | null) => void; optional?: boolean };
let asker: ((ask: PhotoAsk) => void) | null = null;
export function setPhotoAsker(next: ((ask: PhotoAsk) => void) | null): void { asker = next; }

async function hereNow(): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const Location = require('expo-location') as typeof import('expo-location');
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return coords;
    } catch { return null; }
}

const titleOf = (item: ProofItem) => (item.kind === 'habit' ? item.habit.name : item.task.title);

/**
 * Before a tick by hand: true when it may go ahead (no proof needed, or proven
 * by place or photo just now). False when the item ticks itself (it says how)
 * or the photo was not taken. Unticking (`done` false) always goes ahead.
 */
export async function proveTick(item: ProofItem, day: string, done = true): Promise<boolean> {
    if (!done) return true;
    const { rule, runId } = await ruleFor(item);
    if (rule === 'none') {
        // Every habit ticked by hand: the camera opens for a photo of it, skippable (the tick stands
        // either way). Kept in the habit's history and shown to friends on your day (lib/tickPhotos.ts).
        const photos = require('./tickPhotos') as typeof import('./tickPhotos');
        if (item.kind === 'habit' && asker && await photos.tickPhotoOn()) {
            const uri = await new Promise<string | null>(resolve => asker!({ title: titleOf(item), resolve, optional: true }));
            if (uri) void photos.keepTickPhoto(item.habit.id, day, uri);
        }
        return true;
    }
    if (rule === 'health') {
        Alert.alert('Apple Health ticks this one', 'It counts for a challenge, so it fills itself from Health as you go. No need to tick it.');
        return false;
    }
    if (rule === 'focus') {
        const id = item.kind === 'habit' ? item.habit.id : item.task.id;
        Alert.alert('The focus timer ticks this one', 'It counts for a challenge: start the timer on it, and it ticks itself when the time is done.', [
            { text: 'Not now', style: 'cancel' },
            { text: 'Start focus', onPress: () => {
                require('expo-router').router.navigate({ pathname: '/(root)/focus', params: { day: '1', kind: item.kind, id, title: titleOf(item) } });
            } },
        ]);
        return false;
    }
    const places = item.kind === 'habit' ? (item.habit.locationReminders ?? []) : [];
    if (places.length) {
        const here = await hereNow();
        if (here && atPlace(here, places)) return true;
    }
    if (!asker) return false;
    const uri = await new Promise<string | null>(resolve => asker!({ title: titleOf(item), resolve }));
    if (!uri) return false;
    if (item.kind === 'habit') void (require('./tickPhotos') as typeof import('./tickPhotos')).keepTickPhoto(item.habit.id, day, uri);
    if (runId) {
        const { shareProofPhoto } = require('./challenges') as typeof import('./challenges');
        void shareProofPhoto(runId, day, titleOf(item), uri);
    }
    return true;
}

/**
 * A tick from outside the app (the widget, a notification's Done, the Watch,
 * Shortcuts) can't take a photo. One that needs proof is held: not written,
 * and a notification asks to tick it in Habyss. True when held.
 */
export async function holdForProof(item: ProofItem): Promise<boolean> {
    const { rule } = await ruleFor(item);
    if (rule === 'none') return false;
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        const body = rule === 'health' ? 'It counts for a challenge: Apple Health ticks it by itself.'
            : rule === 'focus' ? 'It counts for a challenge: run the focus timer on it in Habyss.'
                : 'It counts for a challenge or a bet: tick it in Habyss with a photo.';
        await Notifications.scheduleNotificationAsync({
            content: { title: `“${titleOf(item)}” needs proof`, body, sound: 'default',
                data: { kind: 'challenge-proof', url: item.kind === 'habit' ? `/habit-detail?habitId=${encodeURIComponent(item.habit.id)}` : '/(root)/(tabs)/roadmap' } },
            trigger: null,
        });
    } catch { /* the tick is still held */ }
    return true;
}
