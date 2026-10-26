/**
 * A brain-dump thought, sorted into the things in it.
 *
 * "Tomorrow I need to get up early, finish the report, call Dad, and fit in a
 * workout" is four tasks for tomorrow; "Saturday: clean the apartment, wash
 * clothes, buy groceries" is three for Saturday; "What if the onboarding was
 * personalised?" is an idea to keep, not a task. Each piece gets a suggested
 * kind, and nothing is created until the person confirms (app/(root)/brain-dump).
 * Pure, so it is tested.
 */
export type ThoughtKind = 'task' | 'habit' | 'goal' | 'note';
export interface ThoughtPiece { text: string; kind: ThoughtKind }

const LEAD = /^(?:(?:so|ok|okay|also|and|but)[,\s]+)*(?:(today|tonight|tomorrow|this weekend|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|before the trip|for the [\w\s'-]{1,30}?)[,:]?\s+)?(?:i\s+(?:really\s+)?(?:need|have|want|should|must|gotta|got)\s+to\s+|i\s+need\s+|need\s+to\s+|i\s+should\s+|todo:?\s*|to do:?\s*)/i;
const DAY_LEAD = /^(today|tonight|tomorrow|this weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*[:,-]\s*/i;

/** A thought that is an idea, a question or a feeling: kept as it is. */
export function isNote(text: string): boolean {
    const t = text.trim();
    if (!t) return true;
    if (/\?\s*$/.test(t)) return true;
    if (/^i (?:have|had) (?:a|an|this) (?:[\w-]+\s+){0,3}idea\b/i.test(t)) return true;
    if (/^(too many|not enough|what if|maybe|i wonder|i feel|i felt|i'?m (?:proud|worried|anxious|happy|sad|thinking)|i miss|i keep|why\b|could i|should i|would a|new idea|idea:|i had an idea|i saw|a cinematic|an illustration|today was|i actually|something about|i think|this could)\b/i.test(t)) return true;
    // No action word at all and long: a reflection.
    return false;
}

function kindOf(text: string): ThoughtKind {
    if (isNote(text)) return 'note';
    if (/\b(every|each|daily|weekly|nightly|times a (?:day|week)|a day|per day|habit|mornings?|evenings?)\b/i.test(text)) return 'habit';
    if (/\b(by (?:the end of|next|december|january|february|march|april|may|june|july|august|september|october|november)|this year|in \d+ (?:weeks|months)|reach|save \$?\d|lose \d|launch|become)\b/i.test(text)) return 'goal';
    return 'task';
}

const tidy = (text: string) => {
    const t = text.trim().replace(/^(?:and|then|also|maybe|plus|or)\s+/i, '').replace(/[.;,]+$/, '').trim();
    // A link stays exactly as written.
    return !t || /^(https?:|www\.)/i.test(t) ? t : t[0].toUpperCase() + t.slice(1);
};

/**
 * The pieces of a thought. A list of actions ("…, …, and …") becomes one
 * piece each, the day it opened with carried onto every piece; anything else
 * is one piece. A single short thing is left alone.
 */
export function splitThought(raw: string): ThoughtPiece[] {
    const text = raw.trim().replace(/\s+/g, ' ');
    if (!text) return [];
    if (isNote(text)) return [{ text: tidy(text), kind: 'note' }];
    // Sentences first ("Need groceries. Especially eggs."): one item each only when each is an action.
    let day = '';
    let body = text;
    const dayLead = body.match(DAY_LEAD);
    if (dayLead) { day = dayLead[1]; body = body.slice(dayLead[0].length); }
    const lead = body.match(LEAD);
    if (lead) { if (lead[1] && !/^for the|^before the/i.test(lead[1])) day = day || lead[1].replace(/^on\s+/i, ''); body = body.slice(lead[0].length); }
    // "For the website I need to …": the subject stays with each piece.
    const subject = lead?.[1] && /^for the|^before the/i.test(lead[1]) ? lead[1].replace(/[,:]$/, '') : '';
    // Only real list separators split: a comma or semicolon between words, or a
    // colon opening a list. Never inside "11:59", "$1,250.75", "42, 17" or a link.
    if (/https?:\/\/|www\./i.test(body)) return [{ text: tidy(text), kind: kindOf(text) }];
    let parts = body
        // A comma inside a number ("1,250", "42, 17") is kept, not split on.
        .replace(/(\d)\s*,\s*(?=(?:and\s+)?\d)/g, '$1\u0003')
        .replace(/([a-z])\s*[:;]\s*/gi, '$1, ')
        .split(/\s*,\s*(?:and\s+|then\s+|or\s+)?/i)
        .map(part => part.replace(/\u0003/g, ', ').trim().replace(/[.!]+$/, ''))
        .filter(Boolean)
        // "Oh no, the assignment…": a sound, not an item.
        .filter(part => !/^(oh no|oh|ugh|ok|okay|hmm|wow|right|so|well|yeah|yes|no)$/i.test(part));
    // "For the birthday party, invite everyone, …": the first part names what the rest is for.
    let about = subject;
    if (!about && parts.length > 2 && /^(?:for|before|after)\s+the\s+[\w\s'-]{1,30}$/i.test(parts[0])) { about = parts[0]; parts = parts.slice(1); }
    if (parts.length < 2) return [{ text: tidy(text), kind: kindOf(text) }];
    // One thought with a "but", "I think", "especially…", "when…" in it is one thought.
    if (parts.some(part => /^(but|except|assuming|especially|when|if|because|so|although|though|unless|i think|wait|actually|which|who)\b/i.test(part))) {
        return [{ text: tidy(text), kind: kindOf(text) }];
    }
    // A list of things ("bills, debt, savings", "an App Store listing, a privacy
    // policy") is one item; a list of actions is several.
    const actions = parts.filter(part => !/^(a|an|the|my|our|some|any|\d)/i.test(part) && part.split(' ').length >= 2).length;
    if (actions < Math.ceil(parts.length / 2)) return [{ text: tidy(text), kind: kindOf(text) }];
    return parts.map(part => {
        const piece = tidy([part, about ? about.toLowerCase() : '', day ? day.toLowerCase() : ''].filter(Boolean).join(' '));
        return { text: piece, kind: kindOf(part) === 'note' ? 'task' : kindOf(part) };
    }).filter(piece => piece.text.length > 1);
}
