import type { CloudData } from '../types';
import { localDateKey } from '../shared/habitSchedule';
import { buildDay, type Today } from './buildDay';

export { buildDay, memoryAfter, minuteOfDay, type ItemKind, type Today, type TodayItem } from './buildDay';

/** Today, as the phone builds it. */
export function buildToday(data: CloudData | null, opts: { now: Date; signedIn: boolean }): Today {
    return buildDay(data, { date: localDateKey(opts.now), now: opts.now, signedIn: opts.signedIn });
}
