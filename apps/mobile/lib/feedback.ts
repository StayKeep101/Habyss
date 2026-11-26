import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSupabase } from './supabase';

/**
 * Telling us something, with as little ceremony as possible.
 *
 * The screen this replaces had a Send button that showed "Sent!" and cleared
 * the field. Nothing ever left the phone — which is worse than having no
 * feedback at all, because the person who took the trouble to write it believed
 * it had arrived.
 *
 * Two rules, both about not making somebody work for the privilege of helping:
 *
 *   Nothing is asked for. Not a name, not an email, not a category, not a
 *   severity. One box and a button. Everything a report actually needs — the
 *   screen, the build, the platform — is collected rather than typed.
 *
 *   It cannot fail in front of them. Feedback written with no signal, or into a
 *   server having a bad day, is kept and sent on the next launch. The only
 *   thing worse than a Send button that lies is one that loses what you wrote.
 */

const CLIENT_KEY = 'habyss_client_id';
const OUTBOX_KEY = 'habyss_feedback_outbox';
/** A queue that grows forever is a memory leak with good intentions. */
const OUTBOX_LIMIT = 20;

export interface FeedbackContext {
    /** Where they were when they said it. */
    screen?: string;
    version?: string;
    platform?: string;
    theme?: string;
}

export interface QueuedFeedback {
    message: string;
    context: FeedbackContext;
    at: number;
}

/**
 * A random id for this install, so anonymous feedback can be grouped into a
 * conversation and the server has something to rate limit against.
 *
 * Not a device identifier and nothing to do with the account: it lives and dies
 * with the app's storage.
 */
export async function clientId(): Promise<string> {
    try {
        const found = await AsyncStorage.getItem(CLIENT_KEY);
        if (found) return found;
        const made = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(CLIENT_KEY, made);
        return made;
    } catch {
        // Storage is unavailable, so this send simply cannot be grouped.
        return `c-unknown-${Math.random().toString(36).slice(2, 10)}`;
    }
}

/** What the app knows about itself, so nobody has to describe their phone. */
export function describeApp(extra: FeedbackContext = {}): FeedbackContext {
    return {
        platform: `${Platform.OS} ${Platform.Version}`,
        version: Constants.expoConfig?.version ?? undefined,
        ...extra,
    };
}

async function outbox(): Promise<QueuedFeedback[]> {
    try {
        const raw = await AsyncStorage.getItem(OUTBOX_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed)
            ? parsed.filter((one: unknown): one is QueuedFeedback =>
                !!one && typeof (one as QueuedFeedback).message === 'string')
            : [];
    } catch {
        return [];
    }
}

async function keep(item: QueuedFeedback): Promise<void> {
    try {
        const queue = [...(await outbox()), item].slice(-OUTBOX_LIMIT);
        await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
    } catch {
        // Nowhere to keep it. Nothing further to try.
    }
}

async function send(item: QueuedFeedback): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    const { error } = await sb.rpc('submit_feedback', {
        p_message: item.message,
        p_client_id: await clientId(),
        p_context: item.context,
    });
    return !error;
}

/**
 * Sends it, or keeps it until it can be sent.
 *
 * Always returns true when the message was worth sending, because from where
 * the user is standing it has been sent: it is written down and it is going.
 * Reporting a network error at them would only ask them to care about a
 * distinction that is ours, not theirs.
 */
export async function sendFeedback(message: string, context: FeedbackContext = {}): Promise<boolean> {
    const clean = message.trim();
    if (!clean) return false;

    const item: QueuedFeedback = { message: clean.slice(0, 2000), context: describeApp(context), at: Date.now() };
    if (await send(item).catch(() => false)) {
        void flushFeedback();
        return true;
    }
    await keep(item);
    return true;
}

/**
 * Tries everything waiting. Called on launch and after a successful send.
 *
 * Anything that fails again stays in the queue in its original order, so a
 * server having a bad afternoon costs nothing but a delay.
 */
export async function flushFeedback(): Promise<number> {
    const queue = await outbox();
    if (queue.length === 0) return 0;

    const left: QueuedFeedback[] = [];
    let sent = 0;
    for (const item of queue) {
        if (await send(item).catch(() => false)) sent += 1;
        else left.push(item);
    }

    try {
        if (left.length) await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(left));
        else await AsyncStorage.removeItem(OUTBOX_KEY);
    } catch {
        // The queue could not be rewritten; at worst something sends twice.
    }
    return sent;
}

/** How many are still waiting, for anything that wants to say so. */
export const pendingFeedback = async (): Promise<number> => (await outbox()).length;
