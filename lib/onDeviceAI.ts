import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateObject, generateText, type LanguageModel } from 'ai';
import { hasTurboModule } from './nativeModules';
import type { z } from 'zod';

/**
 * The on-device model, whichever this phone has.
 *
 * 1. Apple Intelligence (iOS 26+, iPhone 15 Pro and later): built into the
 *    system, already on the phone, nothing to download. Preferred.
 * 2. Llama 3.2 1B through MLC, on every other phone. Downloaded once, on
 *    Wi-Fi, in the background, the first time the app runs.
 *
 * Nothing here leaves the phone. Every caller keeps a rule-based answer as the
 * fallback, so the app behaves the same, only less cleverly, when neither
 * model is ready.
 */

export type OnDeviceEngine = 'apple' | 'llama' | null;


let appleChecked = false;
let appleAvailable = false;

function appleProvider(): any | null {
    if (Platform.OS !== 'ios' || !hasTurboModule('NativeAppleLLM')) return null;
    try {
        return require('@react-native-ai/apple').apple;
    } catch {
        return null;
    }
}

function isAppleReady(): boolean {
    if (!appleChecked) {
        appleChecked = true;
        try { appleAvailable = !!appleProvider()?.isAvailable(); } catch { appleAvailable = false; }
    }
    return appleAvailable;
}

function llama(): typeof import('./LocalLLMService').default | null {
    if (!hasTurboModule('MLCEngine')) return null;
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

/** Set when someone chooses to download the offline model in AI settings. */
export const LLAMA_OPT_IN_KEY = 'habyss_llama_opt_in';

let preparing: Promise<void> | null = null;

/**
 * Called once at launch. Apple's model needs nothing. Otherwise the Llama model
 * is loaded if it is already on the phone, or downloaded on Wi-Fi so the next
 * launch has it. Never throws and never blocks startup.
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
    if (engine === 'llama') {
        const { mlc } = require('@react-native-ai/mlc');
        return mlc.languageModel(llama()!.getModelId());
    }
    return null;
}

const withTimeout = <T,>(work: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([work, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))]);

/**
 * Asks the model for an object matching `schema`. Returns null when no model is
 * ready, it takes longer than `timeoutMs`, or the answer does not validate.
 */
export async function askForObject<T>(
    schema: z.ZodType<T>,
    system: string,
    prompt: string,
    timeoutMs = 6000,
): Promise<T | null> {
    const languageModel = model();
    if (!languageModel) return null;
    try {
        if (currentEngine() === 'apple') {
            // Apple's model supports guided generation: the output is the schema.
            const result = await withTimeout(generateObject({ model: languageModel, schema, system, prompt }), timeoutMs);
            return result ? (result.object as T) : null;
        }
        // The small Llama model is asked for JSON and checked afterwards.
        const result = await withTimeout(generateText({
            model: languageModel,
            system: `${system}\nReply with one JSON object and nothing else.`,
            prompt,
        }), timeoutMs);
        if (!result) return null;
        const json = result.text.slice(result.text.indexOf('{'), result.text.lastIndexOf('}') + 1);
        const parsed = schema.safeParse(JSON.parse(json));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

/** One short line of text, or null. */
export async function askForLine(system: string, prompt: string, timeoutMs = 6000): Promise<string | null> {
    const languageModel = model();
    if (!languageModel) return null;
    try {
        const result = await withTimeout(generateText({ model: languageModel, system, prompt }), timeoutMs);
        const line = result?.text.replace(/^["“\s]+|["”\s]+$/g, '').trim();
        return line ? line : null;
    } catch {
        return null;
    }
}
