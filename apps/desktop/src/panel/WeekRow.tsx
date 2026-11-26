import { localDateKey } from '../shared/habitSchedule';
import { useSwipe } from './swipe';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const R = 14, C = 2 * Math.PI * R;
const parse = (day: string) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };
/** `day` moved by `n` days. */
export const shiftDay = (day: string, n: number) => { const d = parse(day); return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
/** The same day of the month `n` months away, kept inside that month (31 Jan + 1 → 28 Feb). */
export const shiftMonth = (day: string, n: number) => {
  const d = parse(day), last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return localDateKey(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)));
};
/** The month around `day` as whole weeks, Monday first. */
export function monthDays(day: string): string[] {
  const d = parse(day), first = new Date(d.getFullYear(), d.getMonth(), 1), last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const lead = (first.getDay() + 6) % 7, count = Math.ceil((lead + last.getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => localDateKey(new Date(d.getFullYear(), d.getMonth(), 1 - lead + i)));
}

/**
 * The phone's calendar strip (components/Home/CalendarStrip.tsx): a ring per day filled by that day's tally, today marked,
 * the shown day picked. Swiping with two fingers works as the phone's finger does: left and right for the next or previous
 * week (or month, while it is open), down to open the month, up to fold it back to the week.
 */
export function WeekRow({ days, today, shown, share, onPick, month, onMonth }: {
  days: string[]; today: string; shown: string; share: (day: string) => number; onPick: (day: string) => void;
  month: boolean; onMonth: (open: boolean) => void;
}) {
  const swipe = useSwipe(d => {
    if (d === 'left') onPick(month ? shiftMonth(shown, 1) : shiftDay(shown, 7));
    else if (d === 'right') onPick(month ? shiftMonth(shown, -1) : shiftDay(shown, -7));
    else if (d === 'down' && !month) onMonth(true);
    else if (d === 'up' && month) onMonth(false);
    else return false;
  });
  const shownMonth = shown.slice(0, 7);
  const ring = (day: string, label: string) => {
    const n = Number(day.slice(8)), p = Math.max(0, Math.min(1, share(day)));
    const outside = month && day.slice(0, 7) !== shownMonth;
    return (
      <button key={day} type="button" className={`mp-day${day === shown ? ' shown' : ''}${day === today ? ' today' : ''}${outside ? ' outside' : ''}`}
        aria-label={parse(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} aria-pressed={day === shown}
        onClick={() => { onPick(day); if (month) onMonth(false); }}>
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r={R} className="mp-day-track" />
          {p > 0 && <circle cx="18" cy="18" r={R} className="mp-day-fill" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 18 18)" />}
          <text x="18" y="22" textAnchor="middle">{n}</text>
        </svg>
        {label && <span>{label}</span>}
      </button>
    );
  };
  return (
    <nav className={`mp-week${month ? ' month' : ''}`} aria-label={month ? 'Month' : 'Week'} onWheel={swipe}>
      {month && <header className="mp-month-head">
        <strong>{parse(shown).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button type="button" className="mp-link" onClick={() => onMonth(false)}>Week</button>
      </header>}
      {month && <div className="mp-weekdays" aria-hidden="true">{DAYS.map(d => <span key={d}>{d}</span>)}</div>}
      <div className="mp-days">{days.map((day, i) => ring(day, month ? '' : DAYS[i % 7]))}</div>
      {!month && <button type="button" className="mp-month-toggle" aria-label="Show the month" onClick={() => onMonth(true)}><i aria-hidden="true" /></button>}
    </nav>
  );
}
