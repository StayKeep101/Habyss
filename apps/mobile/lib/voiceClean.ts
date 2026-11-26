/**
 * What was said, without the sounds people make while thinking.
 *
 * Rules only, so it is instant, offline and the same on every phone:
 * "um", "uh", "er", "hmm"; "you know" and "I mean" used as fillers; "like,"
 * used as a filler (not "I'd like to"); a word said twice in a row. Then the
 * spacing and the first letter are tidied.
 */
const SOUNDS = /\b(u+m+|u+h+m*|e+r+m*|a+h+|h+m+|m+h*m+)\b[,.]?/gi;
const PHRASES = /(^|[,.!?]\s*|\s)(you know|i mean|sort of like|kind of like)(,|\s(?=[a-z]))/gi;
const LIKE = /(^|[,.!?]\s*)(so\s+)?like,?\s+/gi;
const SO_START = /^(so|okay so|ok so|alright so|well)[,\s]+/i;

export function cleanSpeech(text: string): string {
    let out = ` ${text} `;
    out = out.replace(SOUNDS, ' ');
    out = out.replace(PHRASES, (_match, before: string) => before || ' ');
    out = out.replace(LIKE, (_match, before: string) => before || ' ');
    // "the the", "I I"
    out = out.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
    out = out.replace(/\s+([,.!?])/g, '$1').replace(/([,.!?]){2,}/g, '$1').replace(/\s{2,}/g, ' ').trim();
    out = out.replace(SO_START, '').replace(/^[,.\s]+/, '');
    return out ? out[0].toUpperCase() + out.slice(1) : '';
}

/**
 * The cleaned words, and on a phone with Apple's on-device model, a long
 * ramble condensed to its point — every name, number and time kept, nothing
 * added. Falls back to the cleaned words if the model is absent or slow.
 */
export async function tidySpeech(text: string): Promise<string> {
    const cleaned = cleanSpeech(text);
    if (cleaned.split(/\s+/).length < 14) return cleaned;
    try {
        const { askForLine, isOnDeviceAIReady } = require('./onDeviceAI') as typeof import('./onDeviceAI');
        if (!isOnDeviceAIReady()) return cleaned;
        const line = await askForLine(
            'Rewrite what the person said as one short, clear note in their own voice. Keep every specific detail: names, numbers, amounts, dates, times, places. Drop filler and repetition. Add nothing. Reply with the note only.',
            cleaned,
            4000,
        );
        const summary = line?.trim().replace(/^["“]|["”]$/g, '');
        return summary && summary.length >= 3 ? summary : cleaned;
    } catch {
        return cleaned;
    }
}
