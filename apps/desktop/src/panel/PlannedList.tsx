import type { Today, TodayItem } from '../today/today';
import { dueLabel } from '../shared/dayFlow';
import { hoursLabel } from './countdown';
import { ItemIcon } from './ItemIcon';

/** One row per item (an item the timeline split into parts is one task), its whole length. */
function once(items: TodayItem[]): (TodayItem & { minutes: number })[] {
  const seen = new Map<string, TodayItem & { minutes: number }>();
  for (const i of items) { const k = `${i.kind}:${i.id}`, had = seen.get(k); seen.set(k, had ? { ...had, minutes: had.minutes + i.end - i.start } : { ...i, minutes: i.end - i.start }); }
  return [...seen.values()];
}
const late = (i: TodayItem, day: string) => !i.done && ((!!i.due && i.due < day) || (!!i.deadline && i.deadline < day));

/** The phone's List view: a Tasks section, then Habits, each with See all. */
export function PlannedList({ day, onToggle, onSeeAll }: { day: Today; onToggle: (item: TodayItem, on: boolean, value: number) => void; onSeeAll: () => void }) {
  const rows = once(day.items);
  const tasks = rows.filter(i => i.kind === 'task'), habits = rows.filter(i => i.kind === 'habit');
  const card = (i: TodayItem & { minutes: number }) => {
    const overdue = late(i, day.day);
    return (
      <li key={`${i.kind}:${i.id}`} aria-label={i.title} className={`mp-card${i.done ? ' done' : ''}`}>
        <input type="checkbox" className={`mp-box${overdue ? ' late' : ''}${i.kind === 'habit' ? ' round' : ''}`} aria-label={i.title} checked={i.done} onChange={e => onToggle(i, e.target.checked, 1)} />
        <span className="mp-card-icon" style={{ color: i.color ?? (i.kind === 'task' ? 'var(--warning)' : 'var(--accent)') }}><ItemIcon name={i.kind === 'task' ? 'flash' : i.icon} kind={i.kind} size={16} /></span>
        <span className="mp-card-text">
          <strong style={i.done ? { textDecoration: 'line-through' } : undefined}>{i.title}</strong>
          {(i.priority === 1 || i.deadline) && <small>{i.priority === 1 && <span className="mp-tag urgent">Urgent</span>}{i.deadline && !overdue && <span>{dueLabel(i.deadline, day.day)}</span>}</small>}
        </span>
        <span className="mp-card-side">
          <span>{hoursLabel(i.minutes)}</span>
          {i.kind === 'task' && !i.done && <b className={overdue ? 'late' : 'today'}>{overdue ? 'Overdue' : 'Today'}</b>}
        </span>
      </li>
    );
  };
  const section = (label: string, list: (TodayItem & { minutes: number })[]) => (
    <section className="mp-section" aria-label={label}>
      <header><h3>{label}</h3><button type="button" className="mp-link" onClick={onSeeAll}>See all</button></header>
      {list.length ? <ul className="mp-cards">{list.map(card)}</ul> : <p className="mp-empty">Nothing here today.</p>}
    </section>
  );
  return <div className="mp-list">{section('Tasks', tasks)}{section('Habits', habits)}</div>;
}
