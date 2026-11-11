import { Platform } from 'react-native';
import type { PersonalityModeId } from '@/constants/AIPersonalities';
import HabyssLiveActivity from '@/modules/habyss-live-activity';

/**
 * Echo's morning alarm: a real alarm (AlarmKit, iOS 26+) at your wake time,
 * every day, that rings through Silent and Focus, with Echo's line in its own
 * voice as the title. Settings → Echo → Morning alarm. It follows the wake
 * time whenever that changes.
 */

/** What the alarm says, by Echo's voice. */
export const ALARM_LINES: Record<PersonalityModeId, string> = {
    friendly: 'Good morning! Your day is planned and waiting 💙',
    normal: 'Up. Your plan for today is ready.',
    dad_mode: 'Up. The day will not wait for you.',
    bully_mode: 'Get up. Everyone else already is.',
    goofball: 'Rise and shine. Mostly rise. The shining is optional.',
};

export const morningAlarmAvailable = (): boolean =>
    Platform.OS === 'ios' && !!HabyssLiveActivity?.alarmsAvailable?.();

export type AlarmResult = 'scheduled' | 'cancelled' | 'denied' | 'unavailable' | 'failed';

/** Sets (or clears) the alarm to match Echo's settings and the wake time. */
export async function syncMorningAlarm(): Promise<AlarmResult> {
    if (!morningAlarmAvailable()) return 'unavailable';
    const { getDayWindow, getEchoConfig, getEchoPersonality } = require('./echo') as typeof import('./echo');
    const [config, day, voice] = await Promise.all([getEchoConfig(), getDayWindow(), getEchoPersonality()]);
    if (!config.morningAlarm) {
        await HabyssLiveActivity?.cancelMorningAlarm?.();
        return 'cancelled';
    }
    const [hour, minute] = day.wake.split(':').map(Number);
    const line = ALARM_LINES[voice] ?? ALARM_LINES.normal;
    return (await HabyssLiveActivity?.scheduleMorningAlarm?.(hour, minute, line)) ?? 'unavailable';
}
