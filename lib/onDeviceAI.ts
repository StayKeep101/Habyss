import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateObject, generateText, type LanguageModel } from 'ai';
import { hasTurboModule } from './nativeModules';
import type { z } from 'zod';

/**
 * The on-device model, whichever this phone has.
 *
 * 1. Apple's system model, when Apple Intelligence and its assets are ready.
 * 2. Gemma 3n E2B through llama.cpp (llama.rn), downloaded explicitly in Echo settings.
 *
 * Nothing here leaves the phone. Every caller keeps a rule-based answer as the
 * fallback, so the app behaves the same, only less cleverly, when neither
 * model is ready.
 */

export type OnDeviceEngine = 'apple' | 'llama' | null;


function appleProvider(): any | null {
    if (Platform.OS !== 'ios' || !hasTurboModule('NativeAppleLLM')) return null;
    try {
        return require('@react-native-ai/apple').apple;
    } catch {
        return null;
    }
}

function isAppleReady(): boolean {
    // Asset readiness can change while the app is open or after visiting Settings.
    try { return !!appleProvider()?.isAvailable(); } catch { return false; }
}

function llama(): typeof import('./LocalLLMService').default | null {
    if (!hasTurboModule('RNLlama')) return null;
    try { return require('./LocalLLMService').default; } catch { return null; }
}

/** Which model answers right now, if any. */
export function currentEngine(): OnDeviceEngine {
    if (isAppleReady()) return 'apple';
    if (llama()?.isReady()) return 'llama';
    return null;
}

/**
 * Whether the quick, everywhere uses (reading what is typed in a sheet, the odd
 * Echo line) may run. Apple's model only: it runs on the Neural Engine and is
 * cheap. The downloaded model is far heavier — waking it on every pause in
 * typing kept older iPhones hot — so it is kept for what it was downloaded for.
 */
export const isOnDeviceAIReady = (): boolean => isAppleReady();

/**
 * Whether Echo can write its own reminder lines: Apple's model, or Gemma once
 * it is downloaded and loaded. Writing happens in small batches now and then,
 * not on every keystroke, so the downloaded model may do it.
 */
export const canWriteLines = (): boolean => currentEngine() !== null;

/** Set when someone chooses to download the offline model in AI settings. */
export const LLAMA_OPT_IN_KEY = 'habyss_llama_opt_in';

let preparing: Promise<void> | null = null;

/**
 * Called once at launch. Apple's model needs nothing. Otherwise the Gemma model
 * is loaded only after the user has opted in and its files are complete.
 * Never downloads at launch and never blocks startup.
 */
export function prepareOnDeviceAI(): Promise<void> {
    if (preparing) return preparing;
    preparing = (async () => {
        if (isAppleReady()) return;
        // The offline model is never downloaded or loaded on its own: ~700 MB on
        // disk and a large share of memory once loaded, which on a phone without
        // Apple Intelligence meant every launch fetched it and then held it,
        // whether or not anything used it. It loads only for someone who chose it.
        const chosen = await AsyncStorage.getItem(LLAMA_OPT_IN_KEY).catch(() => null);
        if (chosen !== '1') return;
        const service = llama();
        if (!service) return;
        await service.init().catch(() => undefined);
    })().finally(() => { preparing = null; });
    return preparing;
}

function model(): LanguageModel | null {
    const engine = currentEngine();
    if (engine === 'apple') return appleProvider()();
    if (engine === 'llama') return llama()!.getLanguageModel();
    return null;
}

let generating = false;
async function runGeneration<T>(work: () => Promise<T>, timeoutMs: number): Promise<T | null> {
    // The native engine does not cancel a generation when a JS timeout expires. Keep
    // ownership until it really ends so a retry cannot start overlapping work.
    if (generating) return null;
    generating = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = Promise.resolve().then(work).finally(() => { generating = false; });
    try {
        return await Promise.race([pending, new Promise<null>(resolve => {
            timer = setTimeout(() => resolve(null), timeoutMs);
        })]);
    } finally { clearTimeout(timer); }
}

/**
 * Asks the model for an object matching `schema`. Returns null when no model is
 * ready, it takes longer than `timeoutMs`, or the answer does not validate.
 */
export async function askForObject<T>(
    schema: z.ZodType<T>,
    system: string,
    prompt: string,
    timeoutMs = currentEngine() === 'llama' ? 30_000 : 6000,
): Promise<T | null> {
    const languageModel = model();
    if (!languageModel) return null;
    try {
        // Both providers support a JSON schema. Previously Llama was asked for
        // "one JSON object" without ever receiving the required field names.
        const result = await runGeneration(() => generateObject({
            model: languageModel, schema, system, prompt, maxOutputTokens: 512, maxRetries: 0,
        }), timeoutMs);
        return result ? (result.object as T) : null;
    } catch {
        return null;
    }
}

/** One short line of text, or null. */
export async function askForLine(system: string, prompt: string, timeoutMs = 6000): Promise<string | null> {
    const languageModel = model();
    if (!languageModel) return null;
    try {
        const result = await runGeneration(() => generateText({
            model: languageModel, system, prompt, maxOutputTokens: 128, maxRetries: 0,
        }), timeoutMs);
        const line = result?.text.replace(/^["“\s]+|["”\s]+$/g, '').trim();
        return line ? line : null;
    } catch {
        return null;
    }
}
