/**
 * What every quick-add reader (tasks, habits, goals, the brain dump) needs
 * before it looks for dates, times and amounts, kept in one place so the
 * readers always agree.
 *
 * - Numbers as people write them: "five", "twenty-five", "a dozen", "8,000",
 *   "1.5", "1 million", "90-minute". Read as numbers; the name keeps the words.
 * - Words that only look like dates are shielded from the date readers:
 *   "Monday's meeting", "tomorrow's seminar", "about Saturday", "Today was…",
 *   links and e-mail addresses. They go back into the title untouched.
 * - A title is tidied only at its edges: a joining word left dangling
 *   ("Postpone the task to", "Go to bed by") goes; "of", "each", "every" and
 *   "on" inside a name ("Drink a glass of water", "Track every purchase",
 *   "Work on the report") stay.
 */

const UNITS: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** A number word, without capture groups: "five", "twenty-five", "a dozen", "a hundred". */
export const NUMBER_WORD = [
    `(?:${Object.keys(TENS).join('|')})(?:[-\\s](?:${Object.keys(UNITS).filter(word => UNITS[word] > 0 && UNITS[word] < 10).join('|')}))?`,
    `(?:a\\s+|one\\s+)?(?:dozen|hundred|thousand)`,
    Object.keys(UNITS).join('|'),
].join('|');

/** A number in digits or words, without capture groups. */
export const NUMBER = `(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?(?:\\s*(?:million|k)\\b)?|${NUMBER_WORD}`;

/** "five" → 5, "twenty-five" → 25, "a dozen" → 12, "8,000" → 8000, "1 million" → 1000000; null when it is not a number. */
export function toNumber(raw: string): number | null {
    const text = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    const digits = text.match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(million|k)?$/);
    if (digits) {
        const value = Number(digits[1].replace(/,/g, ''));
        return digits[2] === 'million' ? value * 1_000_000 : digits[2] === 'k' ? value * 1000 : value;
    }
    const scale = text.match(/^(?:a |one )?(dozen|hundred|thousand)$/);
    if (scale) return { dozen: 12, hundred: 100, thousand: 1000 }[scale[1]] ?? null;
    if (text in UNITS) return UNITS[text];
    const compound = text.match(/^([a-z]+)(?:[-\s]([a-z]+))?$/);
    if (compound && compound[1] in TENS) {
        if (!compound[2]) return TENS[compound[1]];
        if (compound[2] in UNITS && UNITS[compound[2]] < 10) return TENS[compound[1]] + UNITS[compound[2]];
    }
    return null;
}

const DAY_WORD = 'today|tomorrow|tonight|yesterday|sunday|monday|tuesday|wednesday|thursday|friday|saturday|weekend|week|month|year|morning|afternoon|evening';

/**
 * Words hidden from the date and time readers, and put back in the title:
 * a day that belongs to something ("Monday's meeting"), a day something is
 * about ("the group chat about Saturday"), a reflection on a day ("Today was
 * good"), links and e-mail addresses.
 */
export function shield(text: string): { text: string; restore: (value: string) => string } {
    const kept: string[] = [];
    // Held as a character no reader matches: not a digit, not a letter.
    const hold = (match: string) => { kept.push(match); return `\u0001${String.fromCharCode(0xE000 + kept.length - 1)}\u0001`; };
    let out = text
        .replace(/\bhttps?:\/\/\S+|\bwww\.\S+|\b[\w.+-]+@[\w-]+\.[\w.]+/gi, hold)
        .replace(new RegExp(`\\b(?:${DAY_WORD})['’]s\\b`, 'gi'), hold)
        .replace(new RegExp(`\\b(?:about|regarding|from|since|last)\\s+(?:${DAY_WORD})\\b`, 'gi'), hold)
        .replace(/(^|[.!?]\s+)(today|yesterday|tonight)(?=\s+(?:was|is|has|had|felt|went|turned|i\b))/gi, (_all, before: string, word: string) => before + hold(word));
    return {
        text: out,
        restore: value => value.replace(/\u0001([\uE000-\uF8FF])\u0001/g, (_all, mark: string) => kept[mark.charCodeAt(0) - 0xE000] ?? ''),
    };
}

/** Left where a reader took a phrase out, so only the words around it are tidied. */
export const TAKEN = '\u0002';

/**
 * A title after its date, time and amounts were taken out. Only what touches
 * a taken phrase is tidied: "Postpone the task to [next week]" loses "to",
 * "Run 3 km every [Mon, Wed and Fri]" loses "every" and the commas, while
 * "Log in", "Turn on the heater" and "Drink a glass of water" keep every word.
 * Runs of punctuation calm down ("ASAP!!! !!!").
 */
export function tidyTaken(value: string): string {
    const joiner = '(?:and|or|to|on|at|by|for|in|of|each|every|per|due|this|next|about|from|before|after|until|between|starting|beginning|then|that|which|&)';
    const gap = '(?:\\s|[,;:–—-])*';
    let out = value;
    for (let pass = 0; pass < 6; pass++) {
        const next = out
            .replace(new RegExp(`${gap}\\b${joiner}\\b${gap}${TAKEN}`, 'gi'), TAKEN)
            .replace(new RegExp(`${TAKEN}${gap}\\b${joiner}\\b(?=${gap}(?:${TAKEN}|$))`, 'gi'), TAKEN)
            .replace(new RegExp(`${TAKEN}(?:\\s|[,;:–—-])*${TAKEN}`, 'g'), TAKEN);
        if (next === out) break;
        out = next;
    }
    out = out
        .replace(new RegExp(`(?:\\s|[,;:–—-])*${TAKEN}(?:\\s|[,;:–—-])*$`, 'g'), '')
        .replace(new RegExp(`^(?:\\s|[,;:–—-])*${TAKEN}(?:\\s|[,;:–—-])*`, 'g'), '')
        .replace(new RegExp(TAKEN, 'g'), ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/([!?.])(?:\s*[!?.])+/g, '$1')
        .replace(/(^|\s)[!?.]+(?=\s|$)/g, '$1')
        .replace(/\s+\b(?:a|an|the)$/i, '')
        .replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, '')
        .trim();
    return out;
}

/** "wait, actually Thursday": the words after a correction, where the meant date is. */
export function afterCorrection(text: string): string | null {
    const match = text.match(/\b(?:wait|actually|no wait|correction|i mean|scratch that|they moved it to|moved to|changed to)\b[,:]?\s*/i);
    return match && match.index !== undefined ? text.slice(match.index + match[0].length) : null;
}
