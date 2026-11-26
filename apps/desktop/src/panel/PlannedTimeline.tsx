import { useState } from 'react';
import type { Today, TodayItem } from '../today/today';
import { localDateKey } from '../shared/habitSchedule';
import { stack, type Axis } from './axis';
import { clockLabel, hoursLabel } from './countdown';
import { ItemIcon } from './ItemIcon';
import { AmountEntry } from './AmountEntry';
import { AppIcon } from '../ui';

/** At the panel's scale (2.4 px a minute) fifteen minutes is a full row; shorter ones are one compact line. */
const MIN_HEIGHT = 30, FULL = 44;
/** Free time shorter than this is not named: back to back is just a line (the phone's FREE_LABEL_MIN). */
const FREE_LABEL_MIN = 15;
const pad = (n: number) => String(n).padStart(2, '0');
const tickable = (i: TodayItem) => i.kind === 'habit' || i.kind === 'task';
const share = (lived: number, from: number, to: number) => Math.max(0, Math.min(1, (lived - from) / Math.max(1, to - from)));

/**
 * The phone's Today timeline (components/Roadmap/DayTimeline.tsx), on the clock the tracked side shares:
 * - each habit and task a pill of its own colour, as tall as it is long; a habit's round, a task's squarer;
 * - the pill fills as its time goes, and the line to the next one fills as the free time between them goes;
 * - free time of a quarter of an hour or more is named in the gap ("Free · 45 min");
 * - Wake up and Bedtime mark the ends of the day;
 * - the time above the name, Urgent and Hard, the live clock on what is on now, the check ring in the item's colour.
 * Meals, events and travel sit where they are, without a check. Pointing along the day line shows only what is set then.
 */
export function PlannedTimeline({ day, axis, now, amountFor, onToggle, at = null }: {
  day: Today; axis: Axis; now: number | null;
  /** The minute read off the day line (hovered): only what is set then is shown, as the phone's strip does. */
  at?: number | null;
  /** The unit and target of an amount habit, or null for done / not done. */
  amountFor: (item: TodayItem) => { unit: string; target: number } | null;
  onToggle: (item: TodayItem, on: boolean, value: number) => void;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  const reading = at !== null;
  const rows = stack(day.items.filter(i => i.end > axis.from && i.start < axis.to && (!reading || (i.start <= at && at < i.end))), axis, MIN_HEIGHT);
  const bottom = rows.reduce((m, r) => Math.max(m, r.top + r.height), 0);
  // Up to when this day has been lived: now today, all of a day gone, none of a day ahead. Every fill reads it.
  const today = localDateKey(new Date(now ?? Date.now()));
  const nowMinute = now !== null ? (() => { const d = new Date(now); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; })() : null;
  const lived = day.day === today && nowMinute !== null ? nowMinute : day.day < today ? Infinity : -Infinity;
  const bed = day.window.sleep <= day.window.wake ? day.window.sleep + 1440 : day.window.sleep;
  if (reading && rows.length === 0) return <p className="mp-empty mp-plan-empty">Nothing on at this time.</p>;
  return (
    <ol className="mp-plan" style={{ height: Math.max(axis.height, bottom + 40) }}>
      {!reading && <Edge icon="sunny" label="Wake up" minute={day.window.wake} top={axis.y(day.window.wake) - 32} />}
      {rows.map((i, n) => {
        const next = rows[n + 1];
        const key = `${i.kind}:${i.id}:${i.start}`, color = i.color ?? (i.kind === 'task' ? 'var(--warning)' : 'var(--accent)');
        const height = i.height;
        const isNow = i.state === 'now' && now !== null;
        const elapsed = i.done || i.state === 'done' ? 1 : share(lived, i.start, i.end);
        const amount = !i.done && i.kind === 'habit' ? amountFor(i) : null;
        const check = () => { if (i.done) onToggle(i, false, 1); else if (amount) setAsking(key); else onToggle(i, true, 1); };
        const travel = i.kind === 'event' && /:(to|back)$/.test(i.id);
        const corner = i.kind === 'task' ? 12 : 22;
        const gapTop = i.top + height, gapHeight = next ? next.top - gapTop : 0, freeMinutes = next ? next.start - i.end : 0;
        return [
          // The line to the next one: lived in this item's colour, the rest the quiet track.
          next && !reading && <li key={`${key}:link`} aria-hidden="true" className="mp-link-line" style={{ top: gapTop - 6, height: Math.max(0, gapHeight) + 12 }}>
            <i style={{ height: `${share(lived, i.end, Math.max(i.end + 1, next.start)) * 100}%`, background: color }} />
          </li>,
          next && !reading && freeMinutes >= FREE_LABEL_MIN && gapHeight >= 32 && <li key={`${key}:free`} aria-hidden="true" className="mp-free" style={{ top: gapTop + gapHeight / 2 - 8 }}>{`Free · ${hoursLabel(freeMinutes)}`}</li>,
          <li key={key} aria-label={i.title} className={`mp-item ${i.kind}${i.done ? ' done' : ''}${isNow ? ' now' : ''}${i.fixed ? ' fixed' : ''}${height < FULL ? ' compact' : ''}`} style={{ top: i.top, height }}>
            <span className={`mp-icon${travel ? ' travel' : ''}`} style={{ borderRadius: Math.min(height / 2, corner), borderColor: color, color: elapsed >= 1 ? 'var(--bg)' : color, background: elapsed >= 1 ? color : undefined }}>
              {elapsed > 0 && elapsed < 1 && <i className="mp-fill" style={{ height: `${elapsed * 100}%`, background: color }} />}
              <span className="mp-icon-mark" style={elapsed > 0.5 && elapsed < 1 ? { color: 'var(--bg)' } : undefined}><ItemIcon name={i.icon} kind={i.kind} size={height < FULL ? 14 : 18} /></span>
              {i.locked && <i className="mp-badge" title="Exact time" style={{ color }}><AppIcon name="timer" size={10} /></i>}
              {i.anchoredTo && <i className="mp-badge link" title={`Held to ${i.anchoredTo}`} style={{ color }}><AppIcon name="sync" size={10} /></i>}
            </span>
            {isNow && <span className="mp-nowchip" style={{ top: Math.max(0, Math.min(height - 18, share(nowMinute ?? 0, i.start, i.end) * height - 9)), background: color }}>{(() => { const d = new Date(now!); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; })()}</span>}
            <div className="mp-item-text">
              <small>
                {isNow && <b className="mp-now-word">Now</b>}
                {`${clockLabel(i.start % 1440)}–${clockLabel(i.end % 1440)}`}
                {i.priority === 1 && <span className="mp-tag urgent">Urgent</span>}
                {i.difficulty === 3 && <span className="mp-tag hard">Hard</span>}
              </small>
              <strong style={i.done ? { textDecoration: 'line-through' } : undefined}>{i.title}</strong>
              {asking === key && amount && <AmountEntry title={i.title} unit={amount.unit} target={amount.target} onCancel={() => setAsking(null)} onSave={v => { setAsking(null); onToggle(i, true, v); }} />}
            </div>
            {tickable(i) && <button type="button" className={`mp-ring-check${i.done ? ' on' : ''}`} aria-label={i.done ? `Mark ${i.title} not done` : `Mark ${i.title} done`} style={{ borderColor: color, background: i.done ? color : undefined }} onClick={check}>
              {i.done && <AppIcon name="checkmark" size={height < FULL ? 12 : 14} />}
            </button>}
          </li>,
        ];
      })}
      {!reading && <Edge icon="moon" label="Bedtime" minute={bed} top={Math.max(axis.y(bed) + 4, bottom + 8)} />}
      {nowMinute !== null && day.day === today && nowMinute >= axis.from && nowMinute <= axis.to && <li className="mp-nowline" aria-hidden="true" style={{ top: axis.y(nowMinute) }} />}
    </ol>
  );
}

/** Waking or bedtime: a quiet marker at the top or the bottom of the day. */
function Edge({ icon, label, minute, top }: { icon: 'sunny' | 'moon'; label: string; minute: number; top: number }) {
  return (
    <li className="mp-edge" style={{ top }} aria-label={`${label}, ${clockLabel(minute % 1440)}`}>
      <span className="mp-edge-dot"><AppIcon name={icon} size={13} /></span>
      <span className="mp-edge-text"><b>{label}</b><small>{clockLabel(minute % 1440)}</small></span>
    </li>
  );
}
