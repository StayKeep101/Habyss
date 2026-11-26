import { readVoice, type VoiceKind } from './voiceIntent';
import { cleanSpeech } from './voiceClean';

/**
 * Speaking freely, understood: one ramble ("um so tomorrow I need to call the
 * bank and uh I want to start running every morning, and also I'd love to
 * read twelve books this year") turned into the separate things in it, each a
 * task or a habit, written the way you'd have typed it.
 *
 * Rules first, so it is instant, offline and the same everywhere: the sounds
 * of thinking out (lib/voiceClean.ts), split where one thought ends and the
 * next begins, each piece read by the same reader the create button uses
 * (lib/voiceIntent.ts). Where Apple's on-device model is ready, it does the
 * splitting and reading instead, and the rules are the fallback.
 */
export interface VoiceItem { kind: VoiceKind; text: string }

/** Where one thing ends and the next begins, said out loud. */
const BREAKS = /(?:[.!?;]+\s+|\s*,?\s*\b(?:and also|also|and then|then|plus|another thing is|another thing|oh and|and i (?:also )?(?:need|have|want|should|gotta|got) to|and i'd (?:like|love) to|and i want|and i need)\b\s*,?\s*)/i;

/** "I need to", "I'd love to", "I should": how a thing is said, not what it is, wherever it comes. */
const LEAD = /\b(?:(?:i|we)(?:'d|\s+would)?\s*(?:really\s+)?(?:need|have|want|should|gotta|got|like|love|must|plan|am going|'m going)\s+to\s+|i(?:'m| am) gonna\s+|gotta\s+|remember to\s+|don't forget to\s+)/gi;

const sentence = (text: string) => {
    const trimmed = text.trim().replace(/^(and|but|so|ok|okay)\s+/i, '').replace(/[.!?,;]+$/, '').trim();
    return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : '';
};

/** The things in what was said, by the rules. */
export function splitSpeech(spoken: string): VoiceItem[] {
    const cleaned = cleanSpeech(spoken);
    if (!cleaned) return [];
    const pieces = cleaned.split(BREAKS).map(piece => piece.replace(LEAD, '')).map(sentence).filter(piece => piece.split(/\s+/).length >= 2);
    const items: VoiceItem[] = [];
    for (const piece of pieces.length ? pieces : [sentence(cleaned)]) {
        const read = readVoice(piece);
        if (!read) continue;
        const text = sentence(read.text.replace(LEAD, ''));
        if (text && !items.some(item => item.text.toLowerCase() === text.toLowerCase())) items.push({ kind: read.kind, text });
    }
    return items;
}

/** The things in what was said: by Apple's on-device model when it is ready, by the rules otherwise. */
export async function planFromSpeech(spoken: string): Promise<VoiceItem[]> {
    const ruled = splitSpeech(spoken);
    const cleaned = cleanSpeech(spoken);
    // A short sentence is one thing; the rules read it as well as anything.
    if (cleaned.split(/\s+/).length < 10) return ruled;
    try {
        const { askForObject, isOnDeviceAIReady } = require('./onDeviceAI') as typeof import('./onDeviceAI');
        if (!isOnDeviceAIReady()) return ruled;
        const { z } = require('zod') as typeof import('zod');
        const schema = z.object({
            items: z.array(z.object({
                kind: z.enum(['task', 'habit']).describe('task: done once, including an outcome to reach by a date. habit: repeats (every day, each morning, 3 times a week).'),
                text: z.string().describe('The thing in a few words, as they would type it, keeping every name, number, day and time. No "I need to".'),
            })).describe('Every separate thing they mean to do, in the order said.'),
        });
        const answer = await askForObject(schema,
            'You turn someone speaking freely into the separate things they want to do. Ignore filler and repetition. Add nothing they did not say.',
            `They said: "${cleaned}"`);
        const items = (answer?.items ?? [])
            .map(item => ({ kind: item.kind as VoiceKind, text: sentence(item.text) }))
            .filter(item => item.text.split(/\s+/).length >= 1 && item.text.length <= 140);
        return items.length ? items : ruled;
    } catch {
        return ruled;
    }
}
