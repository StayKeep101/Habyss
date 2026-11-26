import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { speaksAsUser } from './echoWriter';

/**
 * Smarter Echo: the few lines a day where quality shows, written by Claude on
 * Habyss's server (supabase/functions/echo-voice). Opt-in (Echo settings),
 * and only ever a short summary: a few facts about today, a few things the
 * person told Echo, and what Echo said lately so it does not repeat.
 *
 * Kept to the moments that matter, so it stays cheap and never in the way:
 * at most a few lines a day, a couple of hours apart, plus a reply when you
 * answer Echo's question. Anything that fails, or reads wrong, falls back to
 * the written lines, so Echo is never silent and never late.
 */

const KEY = 'habyss_echo_cloud';
/** Lines a day on opening Habyss (replies to your answers are on top). */
export const CLOUD_PER_DAY = 3;
/** The least time between two of them. */
export const CLOUD_GAP_MS = 2 * 60 * 60_000;
const TIMEOUT_MS = 6000;

interface Usage { day: string; count: number; lastAt: number }

/** Whether an opening line may come from the server now. Pure. */
export function cloudAllowed(usage: Usage | null, day: string, now: number): boolean {
    if (!usage || usage.day !== day) return true;
    return usage.count < CLOUD_PER_DAY && now - usage.lastAt >= CLOUD_GAP_MS;
}

/** A line from the server is used only when it reads as Echo talking to you. Pure. */
export function acceptCloudLine(line: unknown, name?: string, said: string[] = []): line is string {
    if (typeof line !== 'string') return false;
    const text = line.trim();
    if (text.length < 2 || text.length > 240) return false;
    if (speaksAsUser(text, name)) return false;
    if (/\d+\s?%/.test(text)) return false;
    return !said.includes(text);
}

async function usage(): Promise<Usage | null> {
    try { return JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') as Usage | null; } catch { return null; }
}

async function count(day: string): Promise<void> {
    const current = await usage();
    const next: Usage = current?.day === day ? { day, count: current.count + 1, lastAt: Date.now() } : { day, count: 1, lastAt: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

export interface CloudAsk {
    voice: PersonalityModeId;
    name?: string;
    facts: string[];
    remembered: string[];
    said: string[];
    /** A reply to Echo's question of the day. */
    reply?: { question: string; answer: string };
}

async function call(ask: CloudAsk): Promise<string | null> {
    const { getSupabase } = require('./supabase') as typeof import('./supabase');
    const sb = getSupabase();
    if (!sb) return null;
    const request = sb.functions.invoke('echo-voice', { body: {
        voice: ask.voice, name: ask.name, moment: ask.reply ? 'reply' : 'open',
        facts: ask.facts, remembered: ask.remembered, said: ask.said,
        question: ask.reply?.question, answer: ask.reply?.answer,
    } });
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), TIMEOUT_MS));
    const result = await Promise.race([request, timeout]).catch(() => null);
    const line = (result as { data?: { line?: unknown } } | null)?.data?.line;
    return acceptCloudLine(line, ask.name, ask.said) ? line.trim() : null;
}

/** An opening line from Smarter Echo, or null (off, used up for now, offline, or not good enough). */
export async function cloudOpeningLine(enabled: boolean, day: string, ask: CloudAsk): Promise<string | null> {
    if (!enabled || !cloudAllowed(await usage(), day, Date.now())) return null;
    const line = await call(ask);
    if (line) await count(day);
    return line;
}

/** Smarter Echo's reply to your answer, or null. */
export async function cloudReply(enabled: boolean, ask: CloudAsk & { reply: { question: string; answer: string } }): Promise<string | null> {
    return enabled ? call(ask) : null;
}
