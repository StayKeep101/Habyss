/**
 * When something the person writes to Echo sounds like real distress.
 *
 * Deliberately narrow: it looks for clear statements about self-harm or not
 * wanting to live, not for sadness or a bad day. It diagnoses nothing. When
 * it matches, Echo stops coaching and shows a calm message with where to get
 * help, instead of a productivity tip.
 */

const SIGNS = [
    /\b(kill|hurt|harm)(ing)?\s+my\s*self\b/i,
    /\bkill\s+me\b/i,
    /\bsuicid(e|al)\b/i,
    /\b(want|wanna|going)\s+to\s+die\b/i,
    /\bend\s+(it\s+all|my\s+life)\b/i,
    /\b(don'?t|do\s+not)\s+want\s+to\s+(live|be\s+alive|exist)\b/i,
    /\bno\s+(reason|point)\s+(to|in)\s+(live|living|go(ing)?\s+on)\b/i,
    /\bself[-\s]?harm\b/i,
];

export function soundsLikeCrisis(text: string): boolean {
    return SIGNS.some(sign => sign.test(text));
}

export const CRISIS_MESSAGE = {
    title: 'You don’t have to carry this alone',
    body: 'It sounds like things are really hard right now. Please reach out to someone you trust. If you might hurt yourself or you are in danger, call or text 988 (Canada and the US) or your local emergency number. Habyss can wait.',
} as const;
