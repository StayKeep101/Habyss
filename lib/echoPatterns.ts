import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import type { CheckIn } from './checkIns';
import type { FocusRecord } from './focusStats';
import { checkInDay } from './checkIns';
import { habitDays, keptRate, shiftDay, type HabitDay, type HistoryDay } from './habitDays';
import { localDateKey } from './habitSchedule';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What Echo finds in everything you record: sleep, energy, mood, focus, and
 * when and how often habits and tasks get done.
 *
 * Every pattern is counted straight off the record, with a floor on how many
 * days it needs and on how big the difference must be, so nothing is said on
 * three data points or a coin-flip gap. Each carries its evidence in words and
 * a `short` form — a few tokens — so the on-device model can be handed the
 * whole picture in one compact line (`patternDigest`) instead of raw data.
 *
 * Cheap: single passes over at most ~60 days, no model involved.
 */

export type PatternKind =
    | 'sleep_energy' | 'sleep_habits' | 'task_hour' | 'habit_hour' | 'weekday'
    | 'mood_habit' | 'energy_habits' | 'focus_habits' | 'focus_hour' | 'keystone' | 'energy_time'
    | 'sleep_focus' | 'energy_focus';

export interface Pattern {
    id: string;
    kind: PatternKind;
    /** What Echo says, in plain words. */
    text: string;
    /** The numbers behind it. */
    evidence: string;
    /** For ordering: bigger, better-supported differences first. */
    strength: number;
    /** A few tokens, for the model's context: "sleep6.5h→energy4.2/3.1". */
    short: string;
}

export interface PatternInput {
    habits: Habit[];
    history: HistoryDay[];
    tasks: Task[];
    /** Minutes asleep, by the morning's date. */
    sleep: Record<string, number>;
    checkIns: CheckIn[];
    focus: FocusRecord[];
    /** When habits were ticked: only ticks made on the day they count for. */
    ticks: { habitId: string; date: string; at: string }[];
    today: string;
}

const DAYS = 60;
const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "6h30", "7h". */
export function sleepLabel(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** "12 pm", "9 am". */
const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`;

/** The day's average answer of one kind, by date. */
function dailyAverage(entries: CheckIn[], kind: CheckIn['kind']): Map<string, number> {
    const sums = new Map<string, number[]>();
    for (const entry of entries) {
        if (entry.kind !== kind) continue;
        const day = checkInDay(entry.at);
        sums.set(day, [...(sums.get(day) ?? []), entry.value]);
    }
    return new Map([...sums].map(([day, values]) => [day, mean(values)]));
}

/** Kept rate over a subset of days, with how many days it stands on. */
const rateOn = (days: HabitDay[]) => ({ ...keptRate(days), days: days.length });

/**
 * The hour band (two hours wide) that holds the most of these times, when it
 * holds a clear share: at least `min` of them and well above an even spread.
 */
function peakBand(hours: number[], min: number): { start: number; share: number; count: number } | null {
    if (hours.length < min) return null;
    const counts = Array(24).fill(0) as number[];
    for (const hour of hours) counts[hour] += 1;
    let best = { start: 0, count: 0 };
    for (let start = 0; start < 24; start++) {
        const count = counts[start] + counts[(start + 1) % 24];
        // On a tie, the band that starts where the times actually are.
        if (count > best.count || (count === best.count && counts[start] > counts[best.start])) best = { start, count };
    }
    const share = best.count / hours.length;
    // Two hours of a spread-out waking day would hold about 1/8 of it.
    return share >= 0.25 && best.count >= 3 ? { start: best.start, share, count: best.count } : null;
}

export function findPatterns(input: PatternInput): Pattern[] {
    const { habits, history, tasks, sleep, checkIns, focus, ticks, today } = input;
    const yesterday = shiftDay(today, -1);
    const record = habitDays(habits, history, {}, DAYS, yesterday, today).filter(day => day.scheduled.length > 0);
    const energy = dailyAverage(checkIns, 'energy');
    const mood = dailyAverage(checkIns, 'mood');
    const floor = shiftDay(today, -DAYS);
    const out: Pattern[] = [];

    // 1. How much sleep you have the most energy after: half-hour bands of
    // sleep, each with three days or more of energy answers.
    const nights = Object.entries(sleep).filter(([date, minutes]) => date >= floor && minutes > 120 && energy.has(date));
    if (nights.length >= 8) {
        const bands = new Map<number, number[]>();
        for (const [date, minutes] of nights) {
            const band = Math.round(minutes / 30) * 30;
            bands.set(band, [...(bands.get(band) ?? []), energy.get(date)!]);
        }
        const ranked = [...bands].filter(([, values]) => values.length >= 3)
            .map(([band, values]) => ({ band, avg: mean(values), n: values.length }))
            .sort((a, b) => b.avg - a.avg);
        const overall = mean(nights.map(([date]) => energy.get(date)!));
        const top = ranked[0];
        if (ranked.length >= 2 && top.avg - overall >= 0.4) {
            out.push({
                id: `sleep_energy:${top.band}`, kind: 'sleep_energy',
                text: `You have the most energy after about ${sleepLabel(top.band)} of sleep.`,
                evidence: `Energy ${round1(top.avg)} of 5 after ${sleepLabel(top.band)} nights (${top.n} days), ${round1(overall)} on average.`,
                strength: (top.avg - overall) * 40 + top.n,
                short: `sleep${sleepLabel(top.band)}→energy${round1(top.avg)}/${round1(overall)}`,
            });
        }
    }

    // 2. Sleep and habits: the day after a long night against a short one.
    const slept = record.filter(day => sleep[day.date] > 120);
    if (slept.length >= 8) {
        const sorted = slept.map(day => sleep[day.date]).sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const long = rateOn(slept.filter(day => sleep[day.date] >= median));
        const short = rateOn(slept.filter(day => sleep[day.date] < median));
        const gap = long.rate - short.rate;
        if (long.days >= 4 && short.days >= 4 && Math.abs(gap) >= 15) {
            const more = gap > 0;
            out.push({
                id: 'sleep_habits', kind: 'sleep_habits',
                text: more
                    ? `After ${sleepLabel(median)} of sleep or more you keep ${long.rate}% of your habits; after less, ${short.rate}%.`
                    : `Oddly, you keep more habits after shorter nights: ${short.rate}% under ${sleepLabel(median)}, ${long.rate}% over.`,
                evidence: `${long.kept}/${long.countable} kept after ${long.days} longer nights, ${short.kept}/${short.countable} after ${short.days} shorter ones.`,
                strength: Math.abs(gap) + Math.min(long.days, short.days),
                short: `sleep≥${sleepLabel(median)}→habits${long.rate}%/${short.rate}%`,
            });
        }
    }

    // 2b. Sleep and focus: minutes focused the day after a long night against a short one.
    // The research's point (Van Dongen 2003): short sleep costs output you do not feel.
    const focusOn = new Map<string, number>();
    for (const row of focus) if (row.date >= floor && row.date < today) focusOn.set(row.date, (focusOn.get(row.date) ?? 0) + row.seconds / 60);
    const focusDays = (dates: string[]) => mean(dates.map(date => focusOn.get(date) ?? 0));
    const sleptDays = Object.keys(sleep).filter(date => date >= floor && date < today && sleep[date] > 120);
    if (sleptDays.length >= 8 && focusOn.size >= 4) {
        const median = [...sleptDays.map(date => sleep[date])].sort((a, b) => a - b)[Math.floor(sleptDays.length / 2)];
        const longDays = sleptDays.filter(date => sleep[date] >= median);
        const shortDays = sleptDays.filter(date => sleep[date] < median);
        const long = focusDays(longDays);
        const short = focusDays(shortDays);
        if (longDays.length >= 4 && shortDays.length >= 4 && long - short >= 10 && long >= short * 1.2) {
            out.push({
                id: 'sleep_focus', kind: 'sleep_focus',
                text: `After ${sleepLabel(median)} of sleep or more you focus ${Math.round(long)} min a day; after less, ${Math.round(short)}.`,
                evidence: `${longDays.length} longer nights against ${shortDays.length} shorter ones.`,
                strength: (long - short) / 2 + Math.min(longDays.length, shortDays.length),
                short: `sleep≥${sleepLabel(median)}→focus${Math.round(long)}m/${Math.round(short)}m`,
            });
        }
    }

    // 2c. Energy and focus: high-energy days (4 or 5) against the rest.
    const energyDays = [...energy.keys()].filter(date => date >= floor && date < today);
    if (energyDays.length >= 8 && focusOn.size >= 4) {
        const highDays = energyDays.filter(date => energy.get(date)! >= 4);
        const lowDays = energyDays.filter(date => energy.get(date)! < 4);
        const high = focusDays(highDays);
        const low = focusDays(lowDays);
        if (highDays.length >= 4 && lowDays.length >= 4 && high - low >= 10 && high >= low * 1.2) {
            out.push({
                id: 'energy_focus', kind: 'energy_focus',
                text: `On high-energy days you focus ${Math.round(high)} min; on the others, ${Math.round(low)}.`,
                evidence: `${highDays.length} high-energy days against ${lowDays.length} others.`,
                strength: (high - low) / 2 + Math.min(highDays.length, lowDays.length),
                short: `energy≥4→focus${Math.round(high)}m/${Math.round(low)}m`,
            });
        }
    }

    // 3. When tasks get finished.
    const finished = tasks.filter(task => task.status === 'done' && task.completedAt && localDateKey(new Date(task.completedAt)) >= floor);
    const taskPeak = peakBand(finished.map(task => new Date(task.completedAt!).getHours()), 8);
    if (taskPeak) {
        const pct = Math.round(taskPeak.share * 100);
        out.push({
            id: `task_hour:${taskPeak.start}`, kind: 'task_hour',
            text: `You finish most tasks between ${hourLabel(taskPeak.start)} and ${hourLabel((taskPeak.start + 2) % 24)}. Put the hard one there.`,
            evidence: `${taskPeak.count} of ${finished.length} tasks finished in that window, last ${DAYS} days.`,
            strength: pct + finished.length / 4,
            short: `tasks@${taskPeak.start}-${(taskPeak.start + 2) % 24}h ${pct}%`,
        });
    }

    // 4. When habits get ticked.
    const recentTicks = ticks.filter(tick => tick.date >= floor);
    const habitPeak = peakBand(recentTicks.map(tick => new Date(tick.at).getHours()), 10);
    if (habitPeak) {
        const pct = Math.round(habitPeak.share * 100);
        out.push({
            id: `habit_hour:${habitPeak.start}`, kind: 'habit_hour',
            text: `Most of your habits get done between ${hourLabel(habitPeak.start)} and ${hourLabel((habitPeak.start + 2) % 24)}.`,
            evidence: `${habitPeak.count} of ${recentTicks.length} ticks in that window, last ${DAYS} days.`,
            strength: pct + recentTicks.length / 6,
            short: `habits@${habitPeak.start}-${(habitPeak.start + 2) % 24}h ${pct}%`,
        });
    }

    // 5. Your best and worst day of the week.
    const perWeekday = WEEKDAYS.map((_, dow) => rateOn(record.filter(day => new Date(`${day.date}T12:00:00`).getDay() === dow)))
        .map((rate, dow) => ({ ...rate, dow }))
        .filter(rate => rate.days >= 4 && rate.countable >= 6);
    if (perWeekday.length >= 4) {
        const sorted = [...perWeekday].sort((a, b) => b.rate - a.rate);
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];
        if (best.rate - worst.rate >= 20) {
            out.push({
                id: `weekday:${best.dow}:${worst.dow}`, kind: 'weekday',
                text: `${WEEKDAYS[best.dow]} is your strongest day (${best.rate}%); ${WEEKDAYS[worst.dow]} your weakest (${worst.rate}%).`,
                evidence: `Habits kept by weekday over ${DAYS} days, ${best.days} ${WEEKDAYS[best.dow]}s and ${worst.days} ${WEEKDAYS[worst.dow]}s.`,
                strength: best.rate - worst.rate,
                short: `best${WEEKDAYS[best.dow].slice(0, 3)}${best.rate}% worst${WEEKDAYS[worst.dow].slice(0, 3)}${worst.rate}%`,
            });
        }
    }

    // 6. The habit your mood lifts on: mood on days it was done against days it was due and missed.
    let bestMood: Pattern | null = null;
    for (const habit of habits.filter(item => !item.isGoal && !item.isArchived)) {
        const on: number[] = [];
        const off: number[] = [];
        for (const day of record) {
            if (!mood.has(day.date) || !day.scheduled.includes(habit.id) || day.skipped.includes(habit.id)) continue;
            (day.done.includes(habit.id) ? on : off).push(mood.get(day.date)!);
        }
        const lift = mean(on) - mean(off);
        if (on.length < 4 || off.length < 3 || lift < 0.6) continue;
        const candidate: Pattern = {
            id: `mood_habit:${habit.id}`, kind: 'mood_habit',
            text: `Your mood is better on days you do ${habit.name}.`,
            evidence: `Mood ${round1(mean(on))} of 5 on ${on.length} days with it, ${round1(mean(off))} on ${off.length} without.`,
            strength: lift * 35 + Math.min(on.length, off.length),
            short: `${habit.name}→mood${round1(mean(on))}/${round1(mean(off))}`,
        };
        if (!bestMood || candidate.strength > bestMood.strength) bestMood = candidate;
    }
    if (bestMood) out.push(bestMood);

    // 7. Energy and habits: high-energy days against low ones.
    const high = rateOn(record.filter(day => (energy.get(day.date) ?? 0) >= 4));
    const low = rateOn(record.filter(day => { const e = energy.get(day.date); return e !== undefined && e <= 2; }));
    if (high.days >= 3 && low.days >= 3 && high.rate - low.rate >= 15) {
        out.push({
            id: 'energy_habits', kind: 'energy_habits',
            text: `On high-energy days you keep ${high.rate}% of your habits, on drained ones ${low.rate}%. Low days need smaller versions.`,
            evidence: `${high.days} high-energy days, ${low.days} low ones.`,
            strength: high.rate - low.rate + Math.min(high.days, low.days),
            short: `energyHi→habits${high.rate}% lo${low.rate}%`,
        });
    }

    // 8. Focus and habits: days with a real focus session against days without.
    const focusBy = new Map<string, number>();
    for (const row of focus) focusBy.set(row.date, (focusBy.get(row.date) ?? 0) + row.seconds);
    const focused = rateOn(record.filter(day => (focusBy.get(day.date) ?? 0) >= 20 * 60));
    const unfocused = rateOn(record.filter(day => !focusBy.get(day.date)));
    if (focused.days >= 4 && unfocused.days >= 4 && focused.rate - unfocused.rate >= 15) {
        out.push({
            id: 'focus_habits', kind: 'focus_habits',
            text: `Days with a focus session of 20 minutes or more, you keep ${focused.rate}% of habits, against ${unfocused.rate}% without.`,
            evidence: `${focused.days} focused days, ${unfocused.days} without focus.`,
            strength: focused.rate - unfocused.rate + Math.min(focused.days, unfocused.days),
            short: `focus20m→habits${focused.rate}%/${unfocused.rate}%`,
        });
    }

    // 9. When focus goes best: the hours whose sessions you finish more often
    // than you do overall. Where most finished sessions start is not enough on
    // its own: that may just be when most sessions start at all.
    const recentFocus = focus.filter(row => row.date >= floor);
    const finishedFocus = peakBand(recentFocus.filter(row => row.completed).map(row => new Date(row.startedAt).getHours()), 5);
    if (finishedFocus) {
        const inBand = (row: FocusRecord) => { const hour = new Date(row.startedAt).getHours(); return hour === finishedFocus.start || hour === (finishedFocus.start + 1) % 24; };
        const there = recentFocus.filter(inBand);
        const bandRate = there.filter(row => row.completed).length / there.length;
        const overallRate = recentFocus.filter(row => row.completed).length / recentFocus.length;
        const elsewhere = recentFocus.length - there.length;
        if (there.length >= 5 && elsewhere >= 3 && bandRate - overallRate >= 0.1) {
            const [band, all] = [Math.round(bandRate * 100), Math.round(overallRate * 100)];
            out.push({
                id: `focus_hour:${finishedFocus.start}`, kind: 'focus_hour',
                text: `Your focus sessions hold best when started between ${hourLabel(finishedFocus.start)} and ${hourLabel((finishedFocus.start + 2) % 24)}.`,
                evidence: `You finish ${band}% of the sessions started then (${there.length}), ${all}% of all of them, last ${DAYS} days.`,
                strength: (bandRate - overallRate) * 100 + there.length,
                short: `focus@${finishedFocus.start}-${(finishedFocus.start + 2) % 24}h ${band}%/${all}%`,
            });
        }
    }

    // 10. The keystone: the habit on whose days the others get done too.
    let keystone: Pattern | null = null;
    for (const habit of habits.filter(item => !item.isGoal && !item.isArchived)) {
        const rest = (day: HabitDay): HabitDay => ({
            date: day.date,
            scheduled: day.scheduled.filter(id => id !== habit.id),
            done: day.done.filter(id => id !== habit.id),
            skipped: day.skipped.filter(id => id !== habit.id),
        });
        const due = record.filter(day => day.scheduled.includes(habit.id) && !day.skipped.includes(habit.id) && day.scheduled.length >= 3);
        const withIt = rateOn(due.filter(day => day.done.includes(habit.id)).map(rest));
        const without = rateOn(due.filter(day => !day.done.includes(habit.id)).map(rest));
        const gap = withIt.rate - without.rate;
        if (withIt.days < 5 || without.days < 4 || gap < 25) continue;
        const candidate: Pattern = {
            id: `keystone:${habit.id}`, kind: 'keystone',
            text: `${habit.name} is your keystone: on days you do it you keep ${withIt.rate}% of everything else, ${without.rate}% when you skip it.`,
            evidence: `${withIt.days} days with it, ${without.days} without, last ${DAYS} days.`,
            strength: gap + Math.min(withIt.days, without.days),
            short: `keystone:${habit.name} ${withIt.rate}%/${without.rate}%`,
        };
        if (!keystone || candidate.strength > keystone.strength) keystone = candidate;
    }
    if (keystone) out.push(keystone);

    // 11. The part of the day your energy is highest.
    const parts = { morning: [] as number[], afternoon: [] as number[], evening: [] as number[] };
    for (const entry of checkIns) {
        if (entry.kind !== 'energy' || checkInDay(entry.at) < floor) continue;
        const hour = new Date(entry.at).getHours();
        parts[hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'].push(entry.value);
    }
    const ranked = (Object.entries(parts) as [keyof typeof parts, number[]][])
        .filter(([, values]) => values.length >= 3)
        .map(([part, values]) => ({ part, avg: mean(values), n: values.length }))
        .sort((a, b) => b.avg - a.avg);
    if (ranked.length >= 2 && ranked[0].avg - ranked[ranked.length - 1].avg >= 0.7) {
        const [top, bottom] = [ranked[0], ranked[ranked.length - 1]];
        out.push({
            id: `energy_time:${top.part}`, kind: 'energy_time',
            text: `Your energy peaks in the ${top.part} and dips in the ${bottom.part}.`,
            evidence: `Energy ${round1(top.avg)} of 5 in the ${top.part} (${top.n} answers), ${round1(bottom.avg)} in the ${bottom.part}.`,
            strength: (top.avg - bottom.avg) * 30,
            short: `energy↑${top.part}${round1(top.avg)} ↓${bottom.part}${round1(bottom.avg)}`,
        });
    }

    return out.sort((a, b) => b.strength - a.strength);
}

/**
 * Everything Echo knows, in as few tokens as possible, for the on-device
 * model: the facts first, then the patterns' short forms. Capped so a long
 * record never crowds out the question.
 */
export function patternDigest(patterns: Pattern[], facts: { streak?: number; todayDone?: number; todayTotal?: number; focusWeekMin?: number; sleepLast?: number | null } = {}, maxChars = 360): string {
    const parts: string[] = [];
    if (facts.streak) parts.push(`streak${facts.streak}d`);
    if (facts.todayTotal) parts.push(`today${facts.todayDone ?? 0}/${facts.todayTotal}`);
    if (facts.focusWeekMin) parts.push(`focusWk${facts.focusWeekMin}m`);
    if (facts.sleepLast) parts.push(`slept${sleepLabel(facts.sleepLast)}`);
    let digest = parts.join(';');
    for (const pattern of patterns) {
        const next = digest ? `${digest};${pattern.short}` : pattern.short;
        if (next.length > maxChars) break;
        digest = next;
    }
    return digest;
}

/**
 * Whether Echo's line this time is a pattern, and which: about one line in
 * three, cycling through the strongest few so the same one does not repeat.
 */
let turn = 0;
export function nextPatternLine(patterns: Pattern[], random: () => number = Math.random): string | null {
    if (!patterns.length || random() > 0.34) return null;
    const pool = patterns.slice(0, 5);
    const pattern = pool[turn % pool.length];
    turn += 1;
    return pattern.text;
}

/**
 * The strongest few, kept on the phone for what runs outside the screens:
 * the morning check-in notification is scheduled without React around.
 */
const SAVED_KEY = 'habyss_echo_patterns';
export async function savePatternLines(patterns: Pattern[]): Promise<void> {
    try { await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(patterns.slice(0, 5).map(pattern => pattern.text))); } catch { /* only a cache */ }
}
export async function loadPatternLines(): Promise<string[]> {
    try {
        const parsed = JSON.parse((await AsyncStorage.getItem(SAVED_KEY)) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter((line): line is string => typeof line === 'string') : [];
    } catch {
        return [];
    }
}

/**
 * Your best hours, read off the patterns: when energy peaks, else when focus
 * sessions hold, else when tasks get finished. Null until one is clear. The
 * timeline puts hard things here, so a night owl's hard work goes at night.
 */
export function peakWindow(patterns: Pattern[]): { start: number; end: number } | null {
    const parts: Record<string, { start: number; end: number }> = {
        morning: { start: 8 * 60, end: 12 * 60 }, afternoon: { start: 13 * 60, end: 17 * 60 }, evening: { start: 18 * 60, end: 22 * 60 },
    };
    const energy = patterns.find(pattern => pattern.kind === 'energy_time');
    if (energy) return parts[energy.id.split(':')[1]] ?? null;
    const hours = patterns.find(pattern => pattern.kind === 'focus_hour') ?? patterns.find(pattern => pattern.kind === 'task_hour');
    if (!hours) return null;
    const hour = Number(hours.id.split(':')[1]);
    return Number.isFinite(hour) ? { start: hour * 60, end: hour * 60 + 180 } : null;
}
