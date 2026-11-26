import type { Today } from '../today/today';
import { hoursLabel } from './countdown';

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** The phone's day line: waking window, time left in it, and the day's items as one coloured bar with the now marker. */
export function DayLine({ today, nowMinute }: { today: Today; nowMinute: number | null }) {
  const { wake, sleep } = today.window, span = Math.max(1, sleep - wake);
  const pct = (m: number) => `${Math.max(0, Math.min(100, (m - wake) / span * 100))}%`;
  return (
    <div className="mp-dayline">
      <div className="mp-dayline-head">
        <span>{`${hhmm(wake)}–${hhmm(sleep)}`}</span>
        {nowMinute !== null && <b>{nowMinute < sleep ? `${hoursLabel(sleep - Math.max(nowMinute, wake))} left` : 'Day done'}</b>}
      </div>
      <div className="mp-daybar" aria-hidden="true">
        {today.items.filter(i => i.end > wake && i.start < sleep).map(i => (
          <i key={`${i.kind}:${i.id}:${i.start}`} className={i.done ? 'done' : ''} style={{ left: pct(i.start), width: `calc(${pct(i.end)} - ${pct(i.start)})`, background: i.color ?? 'var(--accent)' }} />
        ))}
        {nowMinute !== null && nowMinute >= wake && nowMinute <= sleep && <u style={{ left: pct(nowMinute) }} />}
      </div>
    </div>
  );
}
