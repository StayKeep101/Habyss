import { useState } from 'react';
import type { Today, TodayItem } from '../today/today';
import type { Axis } from './axis';
import { clockLabel } from './countdown';
import { ItemIcon } from './ItemIcon';
import { AmountEntry } from './AmountEntry';
import { AppIcon } from '../ui';

const MIN_HEIGHT = 44;
const pad = (n: number) => String(n).padStart(2, '0');
const tickable = (i: TodayItem) => i.kind === 'habit' || i.kind === 'task';

/** The phone's Today timeline (components/Roadmap/DayTimeline.tsx) on the shared axis: icons on a rail that stretch with an
 * item's length, the time above the title, Urgent/Hard, lock and link badges, the live clock on what is on now, and the
 * check ring in the item's colour. Meals, events and travel sit where they are, without a check. */
export function PlannedTimeline({ day, axis, now, amountFor, onToggle }: {
  day: Today; axis: Axis; now: number | null;
  /** The unit and target of an amount habit, or null for done / not done. */
  amountFor: (item: TodayItem) => { unit: string; target: number } | null;
  onToggle: (item: TodayItem, on: boolean, value: number) => void;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  const rows = day.items.filter(i => i.end > axis.from && i.start < axis.to);
  return (
    <ol className="mp-plan" style={{ height: axis.height }}>
      {rows.map(i => {
        const key = `${i.kind}:${i.id}:${i.start}`, color = i.color ?? 'var(--accent)';
        const height = Math.max(MIN_HEIGHT, (i.end - i.start) * axis.pxPerMin);
        const isNow = i.state === 'now' && now !== null;
        const amount = !i.done && i.kind === 'habit' ? amountFor(i) : null;
        const check = () => { if (i.done) onToggle(i, false, 1); else if (amount) setAsking(key); else onToggle(i, true, 1); };
        return (
          <li key={key} aria-label={i.title} className={`mp-item${i.done ? ' done' : ''}${isNow ? ' now' : ''}${i.fixed ? ' fixed' : ''}`} style={{ top: axis.y(i.start), height }}>
            <span className="mp-icon" style={{ height: Math.min(height, Math.max(MIN_HEIGHT, height - 4)), background: i.done || isNow ? color : undefined, color: i.done || isNow ? 'var(--bg)' : color }}>
              <ItemIcon name={i.icon} kind={i.kind} />
              {i.locked && <i className="mp-badge" title="Exact time"><AppIcon name="timer" size={10} /></i>}
              {i.anchoredTo && <i className="mp-badge link" title={`Held to ${i.anchoredTo}`}><AppIcon name="sync" size={10} /></i>}
            </span>
            {isNow && <span className="mp-nowchip">{(() => { const d = new Date(now!); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; })()}</span>}
            <div className="mp-item-text">
              <small>
                {isNow && <b className="mp-now-word">Now</b>}
                {`${clockLabel(i.start)}–${clockLabel(i.end)}`}
                {i.priority === 1 && <span className="mp-tag urgent">Urgent</span>}
                {i.difficulty === 3 && <span className="mp-tag hard">Hard</span>}
              </small>
              <strong style={i.done ? { textDecoration: 'line-through' } : undefined}>{i.title}</strong>
              {asking === key && amount && <AmountEntry title={i.title} unit={amount.unit} target={amount.target} onCancel={() => setAsking(null)} onSave={v => { setAsking(null); onToggle(i, true, v); }} />}
            </div>
            {tickable(i) && <button type="button" className="mp-ring-check" aria-label={i.done ? `Mark ${i.title} not done` : `Mark ${i.title} done`} style={{ borderColor: color, background: i.done ? color : undefined }} onClick={check} />}
          </li>
        );
      })}
    </ol>
  );
}
