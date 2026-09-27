import type { GoalSpec } from './goalParser';

const months = 'january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec';
export const datePhrases = new RegExp(`\\b(?:${months})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b(?:this|next)\\s+(?:week|month|year)\\b|\\bin\\s+\\d+\\s+days?\\b|\\b(?:every|each|per|a)\\s+(?:day|week|month)\\b|\\b(?:daily|weekly|monthly|christmas|xmas)\\b`, 'gi');
export const amountPhrases = /\b\d+(?:[.,]\d+)?\s*(?:books?|chapters?|pages?|pgs?|km|kilomet(?:er|re)s?|mi|miles?|m|met(?:er|re)s?|ml|millilit(?:er|re)s?|lit(?:er|re)s?|glasses|glass|kg|kilograms?|lb|lbs|pounds?|hours?|hrs?|minutes?|mins?|sessions?|times?|workouts?|steps?|words?|reps?|sets?|laps?|lessons?|tasks?|projects?|dollars?|usd|euros?|eur|gbp|percent)\b|\b\d+(?:[.,]\d+)?\s*%/gi;

/** Preserve every character and selection offset; only recognized details change color. */
export function goalTextSegments(text: string, spec?: GoalSpec) {
    return highlightSegments(text, [spec?.window ? datePhrases : null, spec?.metric_unit ? amountPhrases : null]);
}

export function highlightSegments(text: string, patterns: (RegExp | null)[]) {
    const ranges: { start: number; end: number }[] = [];
    for (const pattern of patterns) {
        if (!pattern) continue;
        for (const match of text.matchAll(pattern)) {
            ranges.push({ start: match.index!, end: match.index! + match[0].length });
        }
    }
    ranges.sort((a, b) => a.start - b.start);
    const parts: { text: string; highlighted: boolean }[] = [];
    let cursor = 0;
    for (const range of ranges) {
        if (range.start < cursor) continue;
        if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), highlighted: false });
        parts.push({ text: text.slice(range.start, range.end), highlighted: true });
        cursor = range.end;
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false });
    return parts;
}
