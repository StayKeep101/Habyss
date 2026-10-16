/**
 * Minutes asleep, from Health's sleep samples.
 *
 * Since iOS 16 the Apple Watch, Garmin and most trackers record a night as
 * stages — CORE, DEEP, REM, with AWAKE between — not as one ASLEEP block, so
 * every asleep stage counts. Two sources often record the same night (a watch
 * and a ring), so overlapping times are merged rather than added. Time in bed
 * is only used when nothing recorded sleep itself.
 */
export interface SleepSample { value?: string; startDate?: string; endDate?: string }

const ASLEEP = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM', 'UNKNOWN']);

function unionMinutes(samples: SleepSample[]): number {
    const spans = samples
        .map(sample => [new Date(sample.startDate ?? '').getTime(), new Date(sample.endDate ?? '').getTime()] as const)
        .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
        .sort((a, b) => a[0] - b[0]);
    let total = 0;
    let open: [number, number] | null = null;
    for (const [start, end] of spans) {
        if (!open || start > open[1]) {
            if (open) total += open[1] - open[0];
            open = [start, end];
        } else if (end > open[1]) {
            open[1] = end;
        }
    }
    if (open) total += open[1] - open[0];
    return total / 60000;
}

export function minutesAsleep(samples: SleepSample[] | null | undefined): number {
    const rows = samples ?? [];
    const asleep = unionMinutes(rows.filter(row => ASLEEP.has(String(row.value))));
    if (asleep > 0) return Math.round(asleep);
    return Math.round(unionMinutes(rows.filter(row => row.value === 'INBED')));
}
