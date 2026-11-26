const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const R = 14, C = 2 * Math.PI * R;

/** The phone's week strip: a ring per day filled by that day's tally, today highlighted, the shown day selectable. */
export function WeekRow({ days, today, shown, share, onPick }: { days: string[]; today: string; shown: string; share: (day: string) => number; onPick: (day: string) => void }) {
  return (
    <nav className="mp-week" aria-label="Week">
      {days.map((day, i) => {
        const n = Number(day.slice(8)), p = Math.max(0, Math.min(1, share(day)));
        return (
          <button key={day} type="button" className={`mp-day${day === shown ? ' shown' : ''}${day === today ? ' today' : ''}`} aria-label={`${DAYS[i]} ${n}`} aria-pressed={day === shown} onClick={() => onPick(day)}>
            <svg viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r={R} className="mp-day-track" />
              {p > 0 && <circle cx="18" cy="18" r={R} className="mp-day-fill" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 18 18)" />}
              <text x="18" y="22" textAnchor="middle">{n}</text>
            </svg>
            <span>{DAYS[i]}</span>
          </button>
        );
      })}
    </nav>
  );
}
