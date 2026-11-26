import type { Habit } from './habitsSQLite';
import { habitDays, keptRate, shiftDay, type HabitDay } from './habitDays';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import type { Pattern, PatternInput } from './echoPatterns';

/**
 * Echo's deeper read of behaviour: not what you did, but how you work.
 *
 *  chain          habits that go together (when you do A, B gets done too)
 *  miss_spiral    what one missed day does to the next ("never miss twice", measured)
 *  relapse        the habit most likely to be missed again once it slips
 *  comeback       how many days you take to come back to a habit after a lapse
 *  drift          habits getting done later and later, and what that costs
 *  overload       how many things a day you can carry before follow-through falls
 *  weekend        weekdays against weekends
 *  trend          the habit rising fastest, and the one slipping fastest
 *  habit_window   the hour after which a habit, not done yet, rarely gets done
 *  task_decay     how fast an untouched task stops getting done
 *  risk_today     the habit most likely to slip today, and why
 *
 * Every finding stands on a floor of days and passes a two-proportion test
 * (|z| ≥ 1.96, about 95%) where it compares rates, so nothing is said on a
 * handful of days or a coin-flip gap. Pure; one pass over ≤ 90 days each.
 */

const DAYS = 90;
const Z95 = 1.96;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const median = (values: number[]) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`;
const hoursLabel = (hours: number) => { const h = Math.floor(hours); const m = Math.round((hours - h) * 60); return m ? `${hourLabel(h).replace(' ', `:${String(m).padStart(2, '0')} `)}` : hourLabel(h); };
const dow = (date: string) => new Date(`${date}T12:00:00`).getDay();
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Two-proportion z: how sure a gap between two rates is real. */
export function twoProportionZ(a: { hit: number; n: number }, b: { hit: number; n: number }): number {
    if (!a.n || !b.n) return 0;
    const p1 = a.hit / a.n, p2 = b.hit / b.n;
    const pooled = (a.hit + b.hit) / (a.n + b.n);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.n + 1 / b.n));
    return se ? (p1 - p2) / se : 0;
}

/** A habit's due days: done or missed (skips are neither). */
function dueOf(record: HabitDay[], id: string): { date: string; done: boolean }[] {
    return record.filter(day => day.scheduled.includes(id) && !day.skipped.includes(id)).map(day => ({ date: day.date, done: day.done.includes(id) }));
}

const live = (habits: Habit[]) => habits.filter(habit => !habit.isArchived);

/** The minutes past midnight a tick was made at. */
const hourOf = (at: string) => { const d = new Date(at); return d.getHours() + d.getMinutes() / 60; };

export function deepPatterns(input: PatternInput): Pattern[] {
    const { habits, history, tasks, ticks, today } = input;
    const yesterday = shiftDay(today, -1);
    const record = habitDays(habits, history, {}, DAYS, yesterday, today).filter(day => day.scheduled.length > 0);
    const byDate = new Map(record.map(day => [day.date, day]));
    const active = live(habits);
    const out: Pattern[] = [];

    // ---------------------------------------------------------------- chain
    // P(B | A done) against P(B | A missed), both due the same day. The pair
    // with the biggest sure lift: do them back to back.
    let chain: Pattern | null = null;
    // Which of two habits tends to be ticked first, on days both were: it leads.
    const firstTick = new Map<string, number>();
    for (const tick of ticks) {
        const key = `${tick.habitId}|${tick.date}`;
        const hour = hourOf(tick.at);
        if (!firstTick.has(key) || hour < firstTick.get(key)!) firstTick.set(key, hour);
    }
    const leads = (a: string, b: string) => {
        let ahead = 0, behind = 0;
        for (const day of record) {
            const [ta, tb] = [firstTick.get(`${a}|${day.date}`), firstTick.get(`${b}|${day.date}`)];
            if (ta === undefined || tb === undefined) continue;
            if (ta < tb) ahead += 1; else if (tb < ta) behind += 1;
        }
        return ahead - behind;
    };
    for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
            // Together is all a record can show, not which causes which. The one usually done first is named first.
            const [a, b] = leads(active[i].id, active[j].id) >= 0 ? [active[i], active[j]] : [active[j], active[i]];
            const withA = { hit: 0, n: 0 }, withoutA = { hit: 0, n: 0 };
            for (const day of record) {
                if (!day.scheduled.includes(a.id) || !day.scheduled.includes(b.id) || day.skipped.includes(a.id) || day.skipped.includes(b.id)) continue;
                const side = day.done.includes(a.id) ? withA : withoutA;
                side.n += 1;
                if (day.done.includes(b.id)) side.hit += 1;
            }
            if (withA.n < 6 || withoutA.n < 4) continue;
            const lift = pct(withA.hit, withA.n) - pct(withoutA.hit, withoutA.n);
            const z = twoProportionZ(withA, withoutA);
            if (lift < 25 || z < Z95) continue;
            const candidate: Pattern = {
                id: `chain:${a.id}:${b.id}`, kind: 'chain',
                text: `${a.name} and ${b.name} go together: on days you do ${a.name}, you do ${b.name} ${pct(withA.hit, withA.n)}% of the time; without it, ${pct(withoutA.hit, withoutA.n)}%. Do them back to back.`,
                evidence: `${withA.hit}/${withA.n} days with ${a.name}, ${withoutA.hit}/${withoutA.n} without, last ${DAYS} days (z ${z.toFixed(1)}).`,
                strength: lift + z * 4,
                short: `chain:${a.name}+${b.name} ${pct(withA.hit, withA.n)}%/${pct(withoutA.hit, withoutA.n)}%`,
            };
            if (!chain || candidate.strength > chain.strength) chain = candidate;
        }
    }
    if (chain) out.push(chain);

    // --------------------------------------------------------- miss_spiral
    // The whole day after a day with a miss, against the day after a clean one.
    const afterMiss = { hit: 0, n: 0 }, afterClean = { hit: 0, n: 0 };
    for (const day of record) {
        const before = byDate.get(shiftDay(day.date, -1));
        if (!before) continue;
        const missed = before.scheduled.some(id => !before.done.includes(id) && !before.skipped.includes(id));
        const side = missed ? afterMiss : afterClean;
        const { kept, countable } = keptRate([day]);
        side.hit += kept; side.n += countable;
    }
    if (afterMiss.n >= 15 && afterClean.n >= 15) {
        const [m, c] = [pct(afterMiss.hit, afterMiss.n), pct(afterClean.hit, afterClean.n)];
        const z = twoProportionZ(afterClean, afterMiss);
        if (c - m >= 15 && z >= Z95) {
            out.push({
                id: 'miss_spiral', kind: 'miss_spiral',
                text: `A miss spreads: the day after you miss something you keep ${m}% of your habits, after a full day ${c}%. The day after a miss is the one to protect.`,
                evidence: `${afterMiss.hit}/${afterMiss.n} kept after days with a miss, ${afterClean.hit}/${afterClean.n} after clean days (z ${z.toFixed(1)}).`,
                strength: c - m + z * 4,
                short: `afterMiss${m}% afterClean${c}%`,
            });
        }
    }

    // ------------------------------------------------- relapse & comeback
    let relapse: Pattern | null = null;
    const gaps: { habit: Habit; days: number }[] = [];
    for (const habit of active) {
        const due = dueOf(record, habit.id);
        const missAgain = { hit: 0, n: 0 }, missAfterDone = { hit: 0, n: 0 };
        let lapseStart: string | null = null;
        for (let i = 1; i < due.length; i++) {
            const side = due[i - 1].done ? missAfterDone : missAgain;
            side.n += 1;
            if (!due[i].done) side.hit += 1;
        }
        for (const entry of due) {
            if (!entry.done && !lapseStart) lapseStart = entry.date;
            if (entry.done && lapseStart) {
                const days = Math.round((new Date(`${entry.date}T12:00:00`).getTime() - new Date(`${lapseStart}T12:00:00`).getTime()) / 86400000);
                gaps.push({ habit, days });
                lapseStart = null;
            }
        }
        if (missAgain.n < 5 || missAfterDone.n < 8) continue;
        const [again, after] = [pct(missAgain.hit, missAgain.n), pct(missAfterDone.hit, missAfterDone.n)];
        const z = twoProportionZ(missAgain, missAfterDone);
        if (again - after < 25 || z < Z95) continue;
        const candidate: Pattern = {
            id: `relapse:${habit.id}`, kind: 'relapse',
            text: `${habit.name} is the one that snowballs: miss it once and you miss the next one ${again}% of the time (${after}% after doing it). Never miss it twice.`,
            evidence: `${missAgain.hit}/${missAgain.n} missed again after a miss, ${missAfterDone.hit}/${missAfterDone.n} after a kept day (z ${z.toFixed(1)}).`,
            strength: again - after + z * 3,
            short: `relapse:${habit.name} ${again}%/${after}%`,
        };
        if (!relapse || candidate.strength > relapse.strength) relapse = candidate;
    }
    if (relapse) out.push(relapse);
    if (gaps.length >= 6) {
        const typical = median(gaps.map(gap => gap.days));
        const quick = gaps.filter(gap => gap.days <= 2).length;
        out.push({
            id: 'comeback', kind: 'comeback',
            text: typical <= 2
                ? `You bounce back fast: after a lapse you're back within ${Math.max(1, Math.round(typical))} day${Math.round(typical) > 1 ? 's' : ''} (${pct(quick, gaps.length)}% of the time within two).`
                : `After a lapse it takes you about ${Math.round(typical)} days to come back. The first day back matters more than the streak.`,
            evidence: `${gaps.length} lapses in ${DAYS} days; typical gap ${typical} days, ${quick} back within two.`,
            strength: 18 + Math.min(gaps.length, 20),
            short: `comeback~${typical}d`,
        });
    }

    // ---------------------------------------------------------------- drift
    // Median tick time, the last two weeks against the four before.
    const recentFloor = shiftDay(today, -14), olderFloor = shiftDay(today, -42);
    const recentTicks = ticks.filter(tick => tick.date >= recentFloor && localDateKey(new Date(tick.at)) === tick.date);
    const olderTicks = ticks.filter(tick => tick.date >= olderFloor && tick.date < recentFloor && localDateKey(new Date(tick.at)) === tick.date);
    if (recentTicks.length >= 10 && olderTicks.length >= 15) {
        const [now, then] = [median(recentTicks.map(tick => hourOf(tick.at))), median(olderTicks.map(tick => hourOf(tick.at)))];
        const shift = now - then;
        if (Math.abs(shift) >= 1.5) {
            const later = shift > 0;
            out.push({
                id: `drift:${later ? 'later' : 'earlier'}`, kind: 'drift',
                text: later
                    ? `Your habits are drifting later: the typical tick is around ${hoursLabel(now)} now, ${hoursLabel(then)} a month ago. Late habits are the first to get dropped.`
                    : `You've moved your habits earlier: the typical tick is around ${hoursLabel(now)} now, ${hoursLabel(then)} a month ago.`,
                evidence: `Median of ${recentTicks.length} ticks in the last 14 days against ${olderTicks.length} in the 4 weeks before.`,
                strength: Math.abs(shift) * 12 + 10,
                short: `drift${later ? '+' : ''}${shift.toFixed(1)}h`,
            });
        }
    }

    // ------------------------------------------------------------- overload
    // Follow-through by how much the day held (habits due + tasks due that day).
    const loads = record.map(day => {
        const dueTasks = tasks.filter(task => task.dueDate === day.date);
        const tasksDone = dueTasks.filter(task => task.status === 'done').length;
        const kept = keptRate([day]);
        return { load: kept.countable + dueTasks.length, hit: kept.kept + tasksDone, n: kept.countable + dueTasks.length };
    }).filter(day => day.n > 0);
    let knee: { at: number; light: { hit: number; n: number }; heavy: { hit: number; n: number }; z: number } | null = null;
    for (let at = 3; at <= 12; at++) {
        const light = { hit: 0, n: 0 }, heavy = { hit: 0, n: 0 };
        let lightDays = 0, heavyDays = 0;
        for (const day of loads) {
            const side = day.load <= at ? light : heavy;
            side.hit += day.hit; side.n += day.n;
            if (day.load <= at) lightDays += 1; else heavyDays += 1;
        }
        if (lightDays < 6 || heavyDays < 6) continue;
        const z = twoProportionZ(light, heavy);
        if (pct(light.hit, light.n) - pct(heavy.hit, heavy.n) >= 20 && z >= Z95 && (!knee || z > knee.z)) knee = { at, light, heavy, z };
    }
    if (knee) {
        const [l, h] = [pct(knee.light.hit, knee.light.n), pct(knee.heavy.hit, knee.heavy.n)];
        out.push({
            id: `overload:${knee.at}`, kind: 'overload',
            text: `Your capacity is about ${knee.at} things a day. Up to ${knee.at} you get ${l}% done; past it, ${h}%. Plan fewer and finish them.`,
            evidence: `Habits and tasks due, ${DAYS} days, split at ${knee.at} (z ${knee.z.toFixed(1)}).`,
            strength: l - h + knee.z * 4,
            short: `capacity${knee.at}/day ${l}%/${h}%`,
        });
    }

    // -------------------------------------------------------------- weekend
    const weekday = { hit: 0, n: 0 }, weekend = { hit: 0, n: 0 };
    let weekendDays = 0;
    for (const day of record) {
        const { kept, countable } = keptRate([day]);
        const side = dow(day.date) === 0 || dow(day.date) === 6 ? weekend : weekday;
        side.hit += kept; side.n += countable;
        if (side === weekend) weekendDays += 1;
    }
    if (weekendDays >= 6 && weekday.n >= 20 && weekend.n >= 10) {
        const [wd, we] = [pct(weekday.hit, weekday.n), pct(weekend.hit, weekend.n)];
        const z = twoProportionZ(weekday, weekend);
        if (Math.abs(wd - we) >= 15 && Math.abs(z) >= Z95) {
            out.push({
                id: `weekend:${wd > we ? 'down' : 'up'}`, kind: 'weekend',
                text: wd > we
                    ? `Weekends break your rhythm: ${we}% kept on Saturdays and Sundays, ${wd}% on weekdays. Give weekends a fixed time, not a free one.`
                    : `You're a weekend person: ${we}% kept on weekends, ${wd}% on weekdays. Weekday habits need to be smaller.`,
                evidence: `${weekend.hit}/${weekend.n} on weekends, ${weekday.hit}/${weekday.n} on weekdays (z ${Math.abs(z).toFixed(1)}).`,
                strength: Math.abs(wd - we) + Math.abs(z) * 3,
                short: `weekend${we}% weekday${wd}%`,
            });
        }
    }

    // ---------------------------------------------------------------- trend
    let rising: Pattern | null = null, slipping: Pattern | null = null;
    for (const habit of active) {
        const due = dueOf(record, habit.id);
        const recent = due.filter(entry => entry.date >= recentFloor);
        const before = due.filter(entry => entry.date < recentFloor && entry.date >= olderFloor);
        if (recent.length < 6 || before.length < 8) continue;
        const r = { hit: recent.filter(entry => entry.done).length, n: recent.length };
        const b = { hit: before.filter(entry => entry.done).length, n: before.length };
        const change = pct(r.hit, r.n) - pct(b.hit, b.n);
        const z = twoProportionZ(r, b);
        if (Math.abs(change) < 25 || Math.abs(z) < Z95) continue;
        const candidate: Pattern = change > 0 ? {
            id: `trend:up:${habit.id}`, kind: 'trend',
            text: `${habit.name} is taking off: ${pct(r.hit, r.n)}% the last two weeks, up from ${pct(b.hit, b.n)}%.`,
            evidence: `${r.hit}/${r.n} lately, ${b.hit}/${b.n} the four weeks before (z ${z.toFixed(1)}).`,
            strength: change + z * 3, short: `${habit.name}↑${pct(b.hit, b.n)}→${pct(r.hit, r.n)}%`,
        } : {
            id: `trend:down:${habit.id}`, kind: 'trend',
            text: `${habit.name} is slipping: ${pct(r.hit, r.n)}% the last two weeks, down from ${pct(b.hit, b.n)}%. Shrink it before it goes.`,
            evidence: `${r.hit}/${r.n} lately, ${b.hit}/${b.n} the four weeks before (z ${Math.abs(z).toFixed(1)}).`,
            strength: -change + Math.abs(z) * 3 + 5, short: `${habit.name}↓${pct(b.hit, b.n)}→${pct(r.hit, r.n)}%`,
        };
        if (change > 0 && (!rising || candidate.strength > rising.strength)) rising = candidate;
        if (change < 0 && (!slipping || candidate.strength > slipping.strength)) slipping = candidate;
    }
    if (slipping) out.push(slipping);
    if (rising) out.push(rising);

    // --------------------------------------------------------- habit_window
    // The hour by which 90% of a habit's ticks are made: past it, it rarely happens.
    let windowFound: Pattern | null = null;
    for (const habit of active) {
        const own = ticks.filter(tick => tick.habitId === habit.id && localDateKey(new Date(tick.at)) === tick.date).map(tick => hourOf(tick.at));
        if (own.length < 10) continue;
        const sorted = [...own].sort((a, b) => a - b);
        const cutoff = Math.ceil(sorted[Math.floor(sorted.length * 0.9) - 1] ?? sorted[sorted.length - 1]);
        if (cutoff >= 20 || cutoff < 6) continue;
        const share = pct(own.filter(hour => hour < cutoff).length, own.length);
        const candidate: Pattern = {
            id: `habit_window:${habit.id}:${cutoff}`, kind: 'habit_window',
            text: `If ${habit.name} isn't done by ${hourLabel(cutoff)}, it almost never happens: ${share}% of the times you do it are before then.`,
            evidence: `${own.length} ticks, ${DAYS} days.`,
            strength: share / 3 + own.length / 2,
            short: `${habit.name}<${cutoff}h ${share}%`,
        };
        if (!windowFound || candidate.strength > windowFound.strength) windowFound = candidate;
    }
    if (windowFound) out.push(windowFound);

    // ----------------------------------------------------------- task_decay
    // Of tasks made, how many get done, by how long they had already sat.
    const floor = shiftDay(today, -DAYS);
    const made = tasks.filter(task => task.createdAt && localDateKey(new Date(task.createdAt)) >= floor && localDateKey(new Date(task.createdAt)) <= shiftDay(today, -7));
    if (made.length >= 15) {
        const ageAtDone = (task: typeof made[number]) => task.completedAt
            ? (new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 86400000 : null;
        const done = made.filter(task => task.status === 'done');
        const quick = done.filter(task => (ageAtDone(task) ?? 99) <= 3).length;
        const sat = made.filter(task => task.status !== 'done' || (ageAtDone(task) ?? 0) > 3);
        const satDone = sat.filter(task => task.status === 'done').length;
        if (sat.length >= 6) {
            const [satRate, all] = [pct(satDone, sat.length), pct(done.length, made.length)];
            if (all - satRate >= 15) {
                out.push({
                    id: 'task_decay', kind: 'task_decay',
                    text: `Tasks go stale fast: ${pct(quick, done.length)}% of what you finish, you finish within 3 days. One that sits longer gets done ${satRate}% of the time. Do it, or drop it.`,
                    evidence: `${made.length} tasks made, ${done.length} done; ${satDone}/${sat.length} of those that sat past 3 days.`,
                    strength: all - satRate + 10,
                    short: `tasks>3d done${satRate}%`,
                });
            }
        }
    }

    // ----------------------------------------------------------- risk_today
    // The habit due today most likely to slip: how often it's kept on this weekday,
    // lately, and after yesterday. Said only when it is genuinely at risk.
    const todayDow = dow(today);
    const yesterdayRecord = byDate.get(yesterday);
    let risk: { habit: Habit; score: number; reasons: string[] } | null = null;
    for (const habit of active) {
        const due = dueOf(record, habit.id);
        if (due.length < 8) continue;
        const sameDay = due.filter(entry => dow(entry.date) === todayDow);
        const lately = due.filter(entry => entry.date >= shiftDay(today, -10));
        const base = due.filter(entry => entry.done).length / due.length;
        const weekdayRate = sameDay.length >= 3 ? sameDay.filter(entry => entry.done).length / sameDay.length : base;
        const lateRate = lately.length >= 3 ? lately.filter(entry => entry.done).length / lately.length : base;
        const missedYesterday = !!yesterdayRecord?.scheduled.includes(habit.id) && !yesterdayRecord.done.includes(habit.id) && !yesterdayRecord.skipped.includes(habit.id);
        // A plain blend; each part is a kept rate, so the score is "chance it is kept".
        const score = 0.4 * weekdayRate + 0.4 * lateRate + 0.2 * base - (missedYesterday ? 0.1 : 0);
        const reasons: string[] = [];
        if (sameDay.length >= 3 && weekdayRate < base - 0.15) reasons.push(`${WEEKDAYS[todayDow]}s you keep it ${Math.round(weekdayRate * 100)}%`);
        if (lately.length >= 3 && lateRate < base - 0.15) reasons.push(`${Math.round(lateRate * 100)}% the last 10 days`);
        if (missedYesterday) reasons.push('missed yesterday');
        if (score < 0.5 && reasons.length && (!risk || score < risk.score)) risk = { habit, score, reasons };
    }
    // Only for a habit actually due today (the record ends yesterday, so the schedule decides).
    if (risk) {
        if (isHabitScheduledForDate(risk.habit, new Date(`${today}T12:00:00`))) {
            const chance = Math.max(5, Math.round(risk.score * 100));
            out.push({
                id: `risk_today:${risk.habit.id}`, kind: 'risk_today',
                text: `${risk.habit.name} is the one most likely to slip today (${risk.reasons.join(', ')}). Do it first, or make it smaller.`,
                evidence: `About a ${chance}% chance it gets done today, from its weekday rate, the last 10 days and yesterday.`,
                strength: (1 - risk.score) * 60 + 10,
                short: `risk:${risk.habit.name}~${chance}%`,
            });
        }
    }

    return out;
}
