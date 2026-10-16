/**
 * What somebody meant when they held the create button and spoke.
 *
 * "Create a habit of reading 20 pages every night" → a habit, "reading 20
 * pages every night". The kind comes from the words they used; the rest is
 * handed to the same sheet and parser typing uses, so speaking and typing
 * always agree.
 */
export type VoiceKind = 'habit' | 'task' | 'goal';

export interface VoiceIntent { kind: VoiceKind; text: string }

const LEAD = /^(?:(?:hey|ok|okay|so|um|uh|please)[,\s]+)*(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:create|add|make|set(?: up)?|start|new|i want|i'd like|remind me)?\s*(?:me\s+)?(?:a|an|the|new|one)?\s*(?:new\s+)?/i;
const KIND = /^(habit|task|to-?do|reminder|goal|target)s?\b\s*(?:of|to|for|called|named|that|:|-)?\s*/i;

const kindOf = (word: string): VoiceKind => {
    const lower = word.toLowerCase();
    if (lower === 'goal' || lower === 'target') return 'goal';
    if (lower === 'habit') return 'habit';
    return 'task';
};

/** With no kind said, a guess from the shape of the sentence. */
function guess(text: string): VoiceKind {
    if (/\b(every|each|daily|weekly|nightly|mornings?|evenings?|times a (?:day|week)|a day|per day|habit)\b/i.test(text)) return 'habit';
    if (/\b(by (?:the end of|next|december|january|february|march|april|may|june|july|august|september|october|november|\d)|this year|in \d+ (?:weeks|months)|reach|save \$?\d|lose \d|run a marathon)\b/i.test(text)) return 'goal';
    return 'task';
}

const tidy = (text: string) => {
    const trimmed = text.trim().replace(/[.!?]+$/, '').trim();
    return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : '';
};

export function readVoice(transcript: string): VoiceIntent | null {
    const spoken = transcript.trim();
    if (!spoken) return null;
    const rest = spoken.replace(LEAD, '');
    const kind = rest.match(KIND);
    if (kind) {
        const text = tidy(rest.slice(kind[0].length));
        return text ? { kind: kindOf(kind[1]), text } : null;
    }
    const text = tidy(rest || spoken);
    return text ? { kind: guess(text), text } : null;
}
