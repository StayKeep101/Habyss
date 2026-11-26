import type { ParsedHabit } from './habitParser';
import type { ParsedTaskText } from './taskParser';
import { amountPhrases, datePhrases, highlightSegments } from './textHighlight';

const weekdays = /\b(?:sundays?|sun|mondays?|mon|tuesdays?|tues|tue|wednesdays?|weds|wed|thursdays?|thurs|thu|fridays?|fri|saturdays?|sat|week\s?days?|week\s?ends?|every\s?day|daily|each day)\b/gi;
const times = /\b(?:at\s+\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?|\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)|noon|midnight|morning|afternoon|evening|tonight)\b/gi;
const relativeDays = /\b(?:the day after tomorrow|today|tomorrow|tmr|tonight|next week|in\s+\d+\s+(?:days?|weeks?))\b/gi;
const priority = /\b(?:urgent|asap|important|critical|high priority|low priority|no rush|sometime|whenever|eventually)\b/gi;

export function habitTextSegments(text: string, parsed?: ParsedHabit | null) {
    return highlightSegments(text, [parsed?.matched.days ? weekdays : null,
        parsed?.matched.time ? times : null, parsed?.targetValue !== undefined ? amountPhrases : null]);
}
export function taskTextSegments(text: string, parsed?: ParsedTaskText | null) {
    return highlightSegments(text, [parsed?.matched.date ? datePhrases : null,
        parsed?.matched.date ? relativeDays : null, parsed?.matched.date ? weekdays : null,
        parsed?.matched.time ? times : null, parsed?.matched.estimate ? amountPhrases : null,
        parsed?.matched.priority ? priority : null]);
}
