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

/** The stages a night is drawn in, deepest last. */
export type SleepStage = 'awake' | 'rem' | 'core' | 'deep';
export const SLEEP_STAGES: SleepStage[] = ['awake', 'rem', 'core', 'deep'];

/**
 * One night, the way a sleep app draws it: when you fell asleep and woke
 * (bed, wake: epoch ms), minutes in each stage, and the stages in order as
 * [stage, start, end] in minutes from `bed`. A tracker that only records
 * "asleep" (no stages) gives `staged: false` and the whole night as core.
 * Overlapping sources: the first recorded stage at each minute wins, so a
 * watch and a ring never double a night.
 */
export interface SleepNight {
    bed: number;
    wake: number;
    asleep: number;
    staged: boolean;
    stages: Record<SleepStage, number>;
    segments: [SleepStage, number, number][];
}

const STAGE_OF: Record<string, SleepStage> = { AWAKE: 'awake', REM: 'rem', CORE: 'core', DEEP: 'deep', ASLEEP: 'core', UNKNOWN: 'core' };

export function sleepNight(samples: SleepSample[] | null | undefined): SleepNight | null {
    const rows = (samples ?? [])
        .map(row => ({ stage: STAGE_OF[String(row.value)], start: new Date(row.startDate ?? '').getTime(), end: new Date(row.endDate ?? '').getTime(), raw: String(row.value) }))
        .filter(row => row.stage && Number.isFinite(row.start) && Number.isFinite(row.end) && row.end > row.start);
    const sleeping = rows.filter(row => row.stage !== 'awake');
    if (!sleeping.length) return null;
    const staged = rows.some(row => row.raw === 'CORE' || row.raw === 'DEEP' || row.raw === 'REM');
    // Only the stages from a source that records them, when one does.
    const used = staged ? rows.filter(row => row.raw !== 'ASLEEP' && row.raw !== 'UNKNOWN') : rows;
    const bed = Math.min(...sleeping.map(row => row.start));
    const wake = Math.max(...sleeping.map(row => row.end));
    const span = Math.ceil((wake - bed) / 60000);
    // Minute by minute: the first stage recorded at that minute (deep over core when two sources disagree).
    const rank: Record<SleepStage, number> = { deep: 0, rem: 1, core: 2, awake: 3 };
    const minute: (SleepStage | null)[] = new Array(Math.max(0, span)).fill(null);
    for (const row of used) {
        const from = Math.max(0, Math.floor((row.start - bed) / 60000));
        const to = Math.min(span, Math.ceil((row.end - bed) / 60000));
        for (let at = from; at < to; at++) {
            const now = minute[at];
            if (now === null || rank[row.stage] < rank[now]) minute[at] = row.stage;
        }
    }
    const stages: Record<SleepStage, number> = { awake: 0, rem: 0, core: 0, deep: 0 };
    const segments: [SleepStage, number, number][] = [];
    for (let at = 0; at < minute.length; at++) {
        // A gap with nothing recorded, inside the night, reads as awake.
        const stage = minute[at] ?? 'awake';
        stages[stage]++;
        const last = segments[segments.length - 1];
        if (last && last[0] === stage && last[2] === at) last[2] = at + 1;
        else segments.push([stage, at, at + 1]);
    }
    return { bed, wake, asleep: stages.rem + stages.core + stages.deep, staged, stages, segments };
}
