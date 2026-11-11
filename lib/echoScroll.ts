import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { talkingPoints, writtenLine, type EchoBrief } from './echoBrief';

/**
 * What Echo says when your chosen apps have had you for 15, 30, 45, 60, 90 and
 * 120 minutes today. iOS tells the Screen Time monitor extension at each of
 * those (ios/ActivityMonitor); it cannot run the model, so the lines are written
 * here, ahead, in your voice and about what is on now, and kept current as the
 * day changes. Apple never tells an app which app you are in, so the lines say
 * "scrolling", not the app's name.
 */
export const SCROLL_THRESHOLDS = [15, 30, 45, 60, 90, 120] as const;

/** The line for each threshold, from the day as it is now. Pure. */
export function scrollLines(voice: PersonalityModeId, brief: EchoBrief): Record<string, string> {
    const out: Record<string, string> = { title: 'Echo' };
    for (const minutes of SCROLL_THRESHOLDS) {
        const at = { ...brief, scrolled: minutes };
        const point = talkingPoints(at).find(entry => entry.kind === 'scrolling');
        if (point) out[String(minutes)] = writtenLine(point, at, voice, minutes);
    }
    return out;
}

let lastSent = '';
/** Hands the lines to the extension, when they changed. A build without it ignores them. */
export function sendScrollLines(voice: PersonalityModeId, brief: EchoBrief): void {
    const lines = scrollLines(voice, brief);
    const json = JSON.stringify(lines);
    if (json === lastSent) return;
    lastSent = json;
    (require('./ScreenTimeService') as typeof import('./ScreenTimeService')).ScreenTimeService.setScrollLines(json);
}
