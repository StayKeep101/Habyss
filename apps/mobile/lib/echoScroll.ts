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

const SENT_KEY = 'habyss_scroll_lines_day';
let sentDay = '';
/**
 * Hands the lines to the extension, at most once a day and only before any
 * scrolling today. On builds up to 1.0.4 handing them over restarts iOS's watch,
 * and a restart replays every threshold already passed today: five old alerts at
 * once. The day's first lines are good enough; the watch then repeats by itself.
 */
export async function sendScrollLines(voice: PersonalityModeId, brief: EchoBrief): Promise<void> {
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const AsyncStorage = (require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')).default;
    const { ScreenTimeService } = require('./ScreenTimeService') as typeof import('./ScreenTimeService');
    const today = localDateKey(new Date());
    if (sentDay === today) return;
    sentDay = today;
    try {
        if ((await AsyncStorage.getItem(SENT_KEY)) === today) return;
        if (((await ScreenTimeService.scrolledToday()) ?? 0) > 0) return;
        await AsyncStorage.setItem(SENT_KEY, today);
        ScreenTimeService.setScrollLines(JSON.stringify(scrollLines(voice, brief)));
    } catch { /* tried again tomorrow */ }
}
