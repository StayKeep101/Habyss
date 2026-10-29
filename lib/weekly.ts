import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';

/**
 * The week in your crew (supabase/migrations/20261029000100): your secret
 * mission, King of the Week, and the king's challenge. The server picks and
 * checks everything; this file asks it, says it in words, and keeps the
 * missions you finished so they count toward your Marks (XP).
 */

export type MissionKind = 'full_day' | 'show_up' | 'react';

export interface Mission {
    friendId: string;
    friendName: string;
    friendAvatar?: string;
    kind: MissionKind;
    target: number;
    progress: number;
    completed: boolean;
    ends: string;
}

export interface Revealed { ownerName: string; ownerAvatar?: string; friendName: string; kind: MissionKind; completed: boolean; mine: boolean }
export interface CrewPerson { userId: string; name: string; avatarUrl?: string; days: number; showUps: number }
export interface Challenge { kingId: string; kingName: string; kingAvatar?: string; text: string; joined: number; joinedByMe: boolean }

/** What a finished mission is worth, in Marks. */
export const MISSION_MARKS = 50;

/** The challenges a king can set in one tap; or their own words. */
export const CHALLENGE_PRESETS = [
    'Every habit, every day this week',
    'Three focus sessions before Sunday',
    'Up before 7, three mornings',
    'No phone for the first hour of the day',
    'Finish one task you keep putting off',
];

/** Your mission, said as a mission: what to get them to do, by when, and to keep it quiet. */
export function missionText(kind: MissionKind, friend: string, target: number): string {
    if (kind === 'full_day') return `Get ${friend} to keep every habit for a whole day before the week ends.`;
    if (kind === 'show_up') return `Get ${friend} to show up on ${target} days this week.`;
    return `Get ${friend} to react to one of your days this week.`;
}

/** What it was, told once the week is over. */
export function revealText(item: Revealed): string {
    const did = item.kind === 'full_day' ? 'keep every habit for a day' : item.kind === 'show_up' ? 'show up 3 days' : 'react to one of their days';
    if (item.mine) return `Your secret was to get ${item.friendName} to ${did}. ${item.completed ? 'Mission accomplished.' : 'Not this time.'}`;
    return `${item.ownerName}’s secret mission was to get you to ${item.kind === 'react' ? 'react to one of their days' : did}. ${item.completed ? 'You helped them do it.' : 'You got away this time.'}`;
}

const name = (row: Record<string, unknown>) => String(row.display_name || row.username || 'Friend');

async function client() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.user?.id ? sb : null;
}

export async function myMission(week: string): Promise<Mission | null> {
    const sb = await client();
    if (!sb) return null;
    const { data, error } = await sb.rpc('my_mission', { p_week: week });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) return null;
    const mission: Mission = {
        friendId: String(row.friend_id), friendName: name(row), friendAvatar: row.avatar_url || undefined,
        kind: row.kind as MissionKind, target: Number(row.target) || 1, progress: Number(row.progress) || 0,
        completed: !!row.completed, ends: String(row.ends),
    };
    if (mission.completed) void keepMissionDone(week, missionText(mission.kind, mission.friendName, mission.target));
    return mission;
}

export async function revealedMissions(week: string): Promise<Revealed[]> {
    const sb = await client();
    if (!sb) return [];
    const { data, error } = await sb.rpc('revealed_missions', { p_week: week });
    if (error || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => ({
        ownerName: String(row.owner_name ?? 'A friend'), ownerAvatar: (row.owner_avatar as string) || undefined,
        friendName: String(row.friend_name ?? 'a friend'), kind: row.kind as MissionKind, completed: !!row.completed, mine: !!row.mine,
    }));
}

/** Everyone in your crew over a range, most consistent first (the server's own order for the crown). */
export async function crewStandings(from: string, to: string): Promise<CrewPerson[]> {
    const sb = await client();
    if (!sb) return [];
    const { data, error } = await sb.rpc('crew_consistency', { p_from: from, p_to: to });
    if (error || !Array.isArray(data)) return [];
    return data
        .map((row: Record<string, unknown>) => ({ userId: String(row.user_id), name: name(row), avatarUrl: (row.avatar_url as string) || undefined, days: Number(row.days) || 0, showUps: Number(row.show_ups) || 0, first: String(row.first_at ?? '') }))
        .sort((a, b) => b.days - a.days || b.showUps - a.showUps || (a.first || '9').localeCompare(b.first || '9') || a.userId.localeCompare(b.userId))
        .map(({ first: _first, ...person }) => person);
}

/** The king of a week: the server's choice, or null when nobody showed up. */
export async function crewKing(from: string, to: string): Promise<CrewPerson | null> {
    const sb = await client();
    if (!sb) return null;
    const { data, error } = await sb.rpc('crew_king', { p_from: from, p_to: to });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) return null;
    return { userId: String(row.user_id), name: name(row), avatarUrl: row.avatar_url || undefined, days: Number(row.days) || 0, showUps: Number(row.show_ups) || 0 };
}

export async function challengesFor(week: string): Promise<Challenge[]> {
    const sb = await client();
    if (!sb) return [];
    const { data, error } = await sb.rpc('crew_challenges_for', { p_week: week });
    if (error || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => ({
        kingId: String(row.king_id), kingName: String(row.king_name ?? 'Your king'), kingAvatar: (row.king_avatar as string) || undefined,
        text: String(row.text), joined: Number(row.joined) || 0, joinedByMe: !!row.joined_by_me,
    }));
}

/** Throws with a sentence fit to show. */
export async function issueChallenge(week: string, text: string): Promise<void> {
    const sb = await client();
    if (!sb) throw new Error('Sign in to set a challenge.');
    const { error } = await sb.rpc('issue_challenge', { p_week: week, p_text: text });
    if (error) throw new Error(error.message);
}

export async function joinChallenge(kingId: string, week: string): Promise<void> {
    const sb = await client();
    if (!sb) throw new Error('Sign in to join.');
    const { error } = await sb.rpc('join_challenge', { p_king: kingId, p_week: week });
    if (error) throw new Error(error.message);
}

/* ------------------------------------------- finished missions, for Marks */

const DONE_KEY = 'habyss_missions_done';
type Done = { week: string; title: string; doneAt: string };
let done: Done[] = [];
let loaded = false;
const listeners = new Set<() => void>();

export const currentMissionsDone = (): Done[] => done;
export function subscribeMissionsDone(listener: () => void): () => void {
    listeners.add(listener);
    if (!loaded) {
        loaded = true;
        AsyncStorage.getItem(DONE_KEY).then(raw => {
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed) && parsed.length) { done = parsed; listeners.forEach(fn => fn()); }
        }).catch(() => undefined);
    }
    return () => { listeners.delete(listener); };
}

/** A finished mission, kept once per week: it counts toward your Marks (lib/marks.ts). */
async function keepMissionDone(week: string, title: string): Promise<void> {
    if (done.some(item => item.week === week)) return;
    done = [...done, { week, title, doneAt: new Date().toISOString() }];
    listeners.forEach(fn => fn());
    await AsyncStorage.setItem(DONE_KEY, JSON.stringify(done)).catch(() => undefined);
}
