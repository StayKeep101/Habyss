import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateObject, generateText, type LanguageModel } from 'ai';
import { hasTurboModule } from './nativeModules';
import type { z } from 'zod';

/**
 * The on-device model, whichever this phone has.
 *
 * 1. Apple's system model, when Apple Intelligence and its assets are ready.
 * 2. A small open model through llama.cpp (llama.rn): Qwen3.5 0.8B (lib/localModelDownload.ts), downloaded explicitly in Echo settings.
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

/**
 * Which model answers right now, if any, for what it is asked:
 * - 'voice', Echo's own lines: Qwen once it is on the phone (more varied in how
 *   it says things), else Apple's model;
 * - 'parse', reading what you type into fields: Apple's model first (quicker,
 *   steadier at filling a form), else Qwen.
 */
export function currentEngine(use: 'voice' | 'parse' = 'voice'): OnDeviceEngine {
    // Downloaded is enough: it loads on the question and lets go after (lib/LocalLLMService.ts use).
    const qwen = !!llama()?.isAvailable();
    if (use === 'voice' && qwen) return 'llama';
    if (isAppleReady()) return 'apple';
    if (qwen) return 'llama';
    return null;
}

/** Apple Intelligence is on this phone and ready. */
export const appleReady = (): boolean => isAppleReady();

/**
 * Whether the quick, everywhere uses (reading what is typed in a sheet, the odd
 * Echo line) may run. Apple's model only: it runs on the Neural Engine and is
 * cheap. The downloaded model is far heavier — waking it on every pause in
 * typing kept older iPhones hot — so it is kept for what it was downloaded for.
 */
export const isOnDeviceAIReady = (): boolean => isAppleReady();

/**
 * Whether Echo can write its own reminder lines: Apple's model, or the offline model once
 * it is downloaded and loaded. Writing happens in small batches now and then,
 * not on every keystroke, so the downloaded model may do it.
 */
export const canWriteLines = (): boolean => currentEngine() !== null;

/** Set when someone chooses to download the offline model in AI settings. */
export const LLAMA_OPT_IN_KEY = 'habyss_llama_opt_in';

let preparing: Promise<void> | null = null;

/**
 * Called once at launch. Apple's model needs nothing. Otherwise the offline model
 * is loaded only after the user has opted in and its files are complete.
 * Never downloads at launch and never blocks startup.
 */
export function prepareOnDeviceAI(): Promise<void> {
    if (preparing) return preparing;
    preparing = (async () => {
        // The offline model is never downloaded or loaded on its own: ~700 MB on
        // disk and a large share of memory once loaded, which on a phone without
        // Apple Intelligence meant every launch fetched it and then held it,
        // whether or not anything used it. It loads only for someone who chose it.
        const chosen = await AsyncStorage.getItem(LLAMA_OPT_IN_KEY).catch(() => null);
        if (chosen !== '1') return;
        const service = llama();
        if (!service) return;
        // Only noted as here; loaded when first asked something.
        await service.checkAvailable().catch(() => undefined);
    })().finally(() => { preparing = null; });
    return preparing;
}

/**
 * Runs `work` with the model that answers for `use`: Apple's at once, or the downloaded one,
 * loaded for the question and let go once quiet (lib/LocalLLMService.ts use). Null when none.
 */
async function withModel<T>(use: 'voice' | 'parse', work: (model: LanguageModel) => Promise<T>): Promise<T | null> {
    const engine = currentEngine(use);
    if (engine === 'apple') return work(appleProvider()());
    if (engine === 'llama') return llama()!.use(work);
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
    timeoutMs = currentEngine('parse') === 'llama' ? 30_000 : 6000,
): Promise<T | null> {
    if (!currentEngine('parse')) return null;
    try {
        // Both providers support a JSON schema. Previously Llama was asked for
        // "one JSON object" without ever receiving the required field names.
        const result = await runGeneration(() => withModel('parse', languageModel => generateObject({
            model: languageModel, schema, system, prompt, maxOutputTokens: 512, maxRetries: 0,
        })), timeoutMs);
        return result ? (result.object as T) : null;
    } catch {
        return null;
    }
}

/** One short line of text, or null. */
export async function askForLine(system: string, prompt: string, timeoutMs = currentEngine('voice') === 'llama' ? 20_000 : 6000): Promise<string | null> {
    if (!currentEngine('voice')) return null;
    try {
        // A line is one or two sentences: 64 tokens is room enough, and half the work of 128.
        const result = await runGeneration(() => withModel('voice', languageModel => generateText({
            model: languageModel, system, prompt, maxOutputTokens: 64, maxRetries: 0,
        })), timeoutMs);
        const line = result?.text.replace(/^["“\s]+|["”\s]+$/g, '').trim();
        return line ? line : null;
    } catch {
        return null;
    }
}
