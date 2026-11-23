import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';
import { emit } from './appEvents';
import { localDateKey } from './habitSchedule';

/**
 * Challenges (supabase/migrations/20261117000100_challenges.sql): Habyss writes
 * the list; you start one alone or with as many friends as you like, free.
 * It adds its habits and tasks to your plan, each marked as part of it. All or
 * nothing: everyone must keep every day, and then each is paid the reward. One
 * missed day, or one person giving up once it has started, ends it for all.
 *
 * The server keeps the runs, checks the days and pays; this file asks it, puts
 * the items in your plan (and takes them out when it ends), and reports each
 * day kept: every challenge habit done that day, and on the last day its tasks
 * too. Those ticks were proven on the way in (lib/challengeProof.ts).
 */

/** How a rule is proven: Apple Health, the focus timer, a photo there and then, or on your word. */
export type Proof = 'health' | 'focus' | 'photo' | 'tick';
export interface ChallengeItem {
    kind: 'habit' | 'task';
    name: string;
    icon?: string;
    proof: Proof;
    /** health: the Apple Health metric and its daily target. */
    metric?: 'steps' | 'exercise' | 'sleep' | 'mindful' | 'distance' | 'flights' | 'energy';
    target?: number;
    unit?: string;
    /** focus: minutes a day on the timer. */
    minutes?: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard';
export interface Challenge {
    id: string;
    title: string;
    summary: string;
    icon: string;
    difficulty: Difficulty;
    days: number;
    reward: number;
    items: ChallengeItem[];
    /** Written by you (or a friend, `ownerId`), not by Habyss: pays no Shards. */
    custom?: boolean;
    ownerId?: string | null;
}

export type RunStatus = 'open' | 'active' | 'won' | 'failed' | 'cancelled';
export interface Member { id: string; name: string; avatar?: string; status: 'joined' | 'invited'; kept: number }
export interface ProofPhoto { user: string; day: string; title: string; url: string }
export interface Run extends Challenge {
    runId: string;
    starts: string;
    ends: string;
    status: RunStatus;
    mine: boolean;
    /** Your own id, to find you among the members. */
    meId: string;
    myStatus: 'joined' | 'invited' | 'declined' | 'left';
    myDays: string[];
    members: Member[];
    proofs: ProofPhoto[];
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

async function client() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.user?.id ? { sb, me: data.session.user.id } : null;
}

const fail = (error: { message?: string } | null, fallback: string) =>
    new Error(error?.message && !/function|schema|relation|permission/i.test(error.message) ? error.message : fallback);

const readItems = (raw: unknown): ChallengeItem[] => (Array.isArray(raw) ? raw : [])
    .filter((item): item is ChallengeItem => !!item && typeof item.name === 'string' && (item.kind === 'habit' || item.kind === 'task'));

/** The list Habyss offers, easiest first. */
export async function challengeCatalog(): Promise<Challenge[]> {
    const ctx = await client();
    if (!ctx) return [];
    const { data, error } = await ctx.sb.from('challenge_catalog').select('*').order('sort');
    if (error || !Array.isArray(data)) return [];
    return data.map(row => ({
        id: String(row.id), title: String(row.title), summary: String(row.summary), icon: String(row.icon || 'trophy'),
        difficulty: row.difficulty as Difficulty, days: Number(row.days) || 1, reward: Number(row.reward) || 0, items: readItems(row.items),
        custom: !!row.owner_id, ownerId: row.owner_id ?? null,
    }));
}

/** Your own challenge: a name, how many days (7 to 75), its rules (each a photo or your word). Returns its id, to start it. */
export async function createChallenge(input: { title: string; summary?: string; icon?: string; days: number; rules: { name: string; proof: 'photo' | 'tick' }[] }): Promise<string> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in to make a challenge.');
    const { data, error } = await ctx.sb.rpc('create_challenge', {
        p_title: input.title.trim(), p_summary: input.summary?.trim() ?? '', p_icon: input.icon ?? 'trophy', p_days: input.days,
        p_items: input.rules.filter(rule => rule.name.trim()).map(rule => ({ name: rule.name.trim(), proof: rule.proof })),
    });
    if (error) throw fail(error, 'The challenge could not be made. Try again in a moment.');
    return String(data);
}

/** Yours: running, waiting on you, or ended in the last two weeks. */
export async function myChallenges(): Promise<Run[]> {
    const ctx = await client();
    if (!ctx) return [];
    const { data, error } = await ctx.sb.rpc('my_challenges');
    if (error || !Array.isArray(data)) return [];
    const photo = (path: string) => ctx.sb.storage.from('proofs').getPublicUrl(path).data.publicUrl;
    return data.map((row: Record<string, any>) => ({
        runId: String(row.id), id: String(row.challenge_id), title: String(row.title), summary: String(row.summary),
        icon: String(row.icon || 'trophy'), difficulty: row.difficulty as Difficulty, days: Number(row.days) || 1,
        reward: Number(row.reward) || 0, items: readItems(row.items), starts: String(row.starts), ends: String(row.ends),
        status: row.status as RunStatus, mine: row.owner_id === ctx.me, meId: ctx.me, myStatus: row.my_status,
        myDays: Array.isArray(row.my_days) ? row.my_days.map(String) : [],
        members: (Array.isArray(row.members) ? row.members : []).map((member: Record<string, any>) => ({
            id: String(member.id), name: String(member.name || 'Friend'), avatar: member.avatar || undefined,
            status: member.status === 'invited' ? 'invited' : 'joined', kept: Number(member.kept) || 0,
        })),
        proofs: (Array.isArray(row.proofs) ? row.proofs : []).map((proof: Record<string, any>) => ({
            user: String(proof.user), day: String(proof.day), title: String(proof.title), url: photo(String(proof.path)),
        })),
    }));
}

/** Starts one, alone or with friends invited (then it starts tomorrow). Throws a sentence fit to show. */
export async function startChallenge(challengeId: string, friends: string[] = []): Promise<void> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in to start a challenge.');
    const { error } = await ctx.sb.rpc('start_challenge', { p_challenge: challengeId, p_friends: friends });
    if (error) throw fail(error, 'The challenge could not start. Try again in a moment.');
    await syncChallenges();
}

export async function respondChallenge(runId: string, accept: boolean): Promise<void> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in first.');
    const { error } = await ctx.sb.rpc('respond_challenge', { p_run: runId, p_accept: accept });
    if (error) throw fail(error, 'That did not go through. Try again in a moment.');
    await syncChallenges();
}

/** Before it starts you just leave; once started, it ends for everyone. */
export async function leaveChallenge(runId: string): Promise<void> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in first.');
    const { error } = await ctx.sb.rpc('leave_challenge', { p_run: runId });
    if (error) throw fail(error, 'That did not go through. Try again in a moment.');
    await syncChallenges();
}

/** A proof photo for the group to see, uploaded to your own folder. Never throws. */
export async function shareProofPhoto(runId: string, day: string, title: string, uri: string): Promise<void> {
    try {
        const ctx = await client();
        if (!ctx) return;
        const { readLocalFile } = require('./profileSync') as typeof import('./profileSync');
        const bytes = await readLocalFile(uri);
        if (!bytes?.byteLength) return;
        const path = `${ctx.me}/${runId}-${day}-${Date.now()}.jpg`;
        const { error } = await ctx.sb.storage.from('proofs').upload(path, bytes, { contentType: 'image/jpeg' });
        if (error) return;
        await ctx.sb.rpc('add_challenge_proof', { p_run: runId, p_day: day, p_title: title, p_path: path });
    } catch { /* the tick stands; only the group's copy is missing */ }
}

// ------------------------------------------------------------ in your plan

/** What each run put in your plan, kept on this phone: run id → its habits and tasks. */
export interface Linked { runId: string; title: string; ends: string; habits: Record<string, Proof>; tasks: Record<string, Proof> }
const LINKS_KEY = 'habyss_challenge_links';
let links: Record<string, Linked> = {};
let linksLoaded = false;

export async function loadLinks(): Promise<Record<string, Linked>> {
    if (linksLoaded) return links;
    linksLoaded = true;
    try { links = JSON.parse((await AsyncStorage.getItem(LINKS_KEY)) ?? '{}') ?? {}; } catch { links = {}; }
    return links;
}
const saveLinks = async () => { await AsyncStorage.setItem(LINKS_KEY, JSON.stringify(links)).catch(() => undefined); emit('challenges_changed'); };

/** The challenge a habit or task belongs to, if any (read after loadLinks). */
export function challengeOf(kind: 'habit' | 'task', id: string): { runId: string; title: string; proof: Proof } | null {
    for (const link of Object.values(links)) {
        const proof = kind === 'habit' ? link.habits[id] : link.tasks[id];
        if (proof) return { runId: link.runId, title: link.title, proof };
    }
    return null;
}

/** Puts a run's habits and tasks in your plan, from its first day to its last. */
async function addItems(run: Run): Promise<void> {
    const { addHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { createTask } = require('./tasks') as typeof import('./tasks');
    const linked: Linked = { runId: run.runId, title: run.title, ends: run.ends, habits: {}, tasks: {} };
    for (const item of run.items) {
        if (item.kind === 'task') {
            const task = await createTask({ title: item.name, dueDate: run.starts, deadline: run.ends }).catch(() => null);
            if (task) linked.tasks[task.id] = item.proof;
            continue;
        }
        const base = { name: item.name, icon: item.icon, startDate: run.starts, endDate: run.ends, taskDays: [], frequency: 'daily' as const, goalPeriod: 'daily' as const };
        const habit = await addHabit(item.proof === 'health' && item.metric
            ? { ...base, trackingMethod: 'numeric', unit: item.unit, goalValue: item.target ?? 1, healthKitMetric: item.metric, healthKitTarget: item.target }
            : item.proof === 'focus' && item.minutes
                ? { ...base, trackingMethod: 'numeric', unit: 'minutes', goalValue: item.minutes, durationMinutes: item.minutes }
                : { ...base, trackingMethod: 'boolean', goalValue: 1 }).catch(() => null);
        if (habit) linked.habits[habit.id] = item.proof;
    }
    links[run.runId] = linked;
    await saveLinks();
    emit('habit_updated', {});
    emit('tasks_changed');
    if (run.items.some(item => item.proof === 'health')) {
        const { syncHealthKitData } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        void syncHealthKitData().catch(() => 0);
    }
}

/** Takes an ended run's items out of your plan: habits archived (their days kept), open tasks removed. */
async function removeItems(runId: string): Promise<void> {
    const link = links[runId];
    if (!link) return;
    const { updateHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { deleteTask, getTasks } = require('./tasks') as typeof import('./tasks');
    for (const id of Object.keys(link.habits)) await updateHabit({ id, isArchived: true }).catch(() => undefined);
    const open = new Set((await getTasks().catch(() => [])).map(task => task.id));
    for (const id of Object.keys(link.tasks)) if (open.has(id)) await deleteTask(id).catch(() => undefined);
    delete links[runId];
    await saveLinks();
    emit('habit_updated', {});
    emit('tasks_changed');
}

const shift = (day: string, by: number) => { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() + by); return localDateKey(date); };

/** The days a run's items were all done on, from its start to today, not yet reported. */
async function keptDays(run: Run, link: Linked, today: string): Promise<string[]> {
    const { getCompletions } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { getTasks } = require('./tasks') as typeof import('./tasks');
    const habits = Object.keys(link.habits);
    const taskIds = Object.keys(link.tasks);
    const tasksDone = taskIds.length === 0 || (await getTasks({ includeDone: true }).catch(() => []))
        .filter(task => taskIds.includes(task.id)).every(task => task.status === 'done');
    const out: string[] = [];
    const last = run.ends < today ? run.ends : today;
    for (let day = run.starts; day <= last; day = shift(day, 1)) {
        if (run.myDays.includes(day)) continue;
        const done = await getCompletions(day).catch(() => ({} as Record<string, boolean>));
        if (!habits.every(id => done[id])) continue;
        // The tasks are due by the end: the last day counts only once they are done.
        if (day === run.ends && !tasksDone) continue;
        out.push(day);
    }
    return out;
}

let syncing: Promise<void> | null = null;
/**
 * Brings this phone and the server together: items added for runs you're in,
 * taken out for runs that ended, and days kept reported. On launch, on a tick,
 * and after any change to a challenge.
 */
export function syncChallenges(): Promise<void> {
    if (syncing) return syncing;
    syncing = (async () => {
        try {
            const ctx = await client();
            if (!ctx) return;
            await loadLinks();
            const runs = await myChallenges();
            const today = localDateKey(new Date());
            const live = runs.filter(run => (run.status === 'open' || run.status === 'active') && run.myStatus === 'joined');
            for (const run of live) if (!links[run.runId]) await addItems(run);
            for (const runId of Object.keys(links)) if (!live.some(run => run.runId === runId)) await removeItems(runId);
            for (const run of live) {
                if (run.starts > today) continue;
                for (const day of await keptDays(run, links[run.runId], today)) {
                    await ctx.sb.rpc('report_challenge_day', { p_run: run.runId, p_day: day });
                }
            }
            emit('challenges_changed');
        } catch { /* tried again on the next tick */ } finally { syncing = null; }
    })();
    return syncing;
}

/**
 * An invite can be answered until the end of the challenge's first day (the
 * server holds the same rule, respond_challenge); after that it is gone. Pure.
 */
export function canAnswer(run: Pick<Run, 'myStatus' | 'status' | 'starts'>, today: string): boolean {
    return run.myStatus === 'invited' && (run.status === 'open' || run.status === 'active') && run.starts >= today;
}

/** What an invite says, true on the day it is read: "7 days · starts today · 250 Shards each if you all make it". Pure. */
export function inviteLine(run: Pick<Run, 'days' | 'reward' | 'starts'>, today: string): string {
    const when = run.starts > today ? 'starts tomorrow' : 'starts today';
    return `${run.days} days · ${when} · ${run.reward} Shards each if you all make it`;
}
