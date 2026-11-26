import { Activity, ArrowUpRight } from 'lucide-react';
import type { Interval } from '../types';
import { appColor, duration, overlap } from '../analytics';
export const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export function AppBadge({ name }: {
    name: string;
}) { return <span className="app-badge" style={{ color: appColor(name), background: `${appColor(name)}18` }}>{name.slice(0, 1).toUpperCase() || '·'}</span>; }
export function Empty({ children }: {
    children: React.ReactNode;
}) { return <div className="empty"><Activity size={26}/><p>{children}</p></div>; }
export function Metric({ title, value, detail, icon }: {
    title: string;
    value: string;
    detail: string;
    icon?: React.ReactNode;
}) { return <section className="metric"><div>{title}{icon}</div><strong>{value}</strong><small>{detail}</small></section>; }
export function CardTitle({ title, detail, action }: {
    title: string;
    detail: string;
    action?: () => void;
}) { return <header className="card-title"><div><h3>{title}</h3><p>{detail}</p></div>{action && <button aria-label={`View ${title}`} onClick={action}><ArrowUpRight size={17}/></button>}</header>; }
export function ActivityRows({ intervals, from, to, onSelect }: {
    intervals: Interval[];
    from: number;
    to: number;
    onSelect?: (i: Interval) => void;
}) { return intervals.length ? <div className="activity-rows">{intervals.map(i => <button key={i.id} className="activity-row" onClick={() => onSelect?.(i)} disabled={!onSelect}><time>{clock(Math.max(i.start, from))}</time><AppBadge name={i.name || i.state}/><div><strong>{i.name || i.state.replaceAll('_', ' ')}</strong><small>{i.title ?? (i.state === 'active' ? `Window title ${i.availability.replaceAll('_', ' ')}` : 'No application attributed')}</small></div><span className="category-tag">{i.state === 'active' ? i.category : i.state}</span><span>{duration(overlap(i.start, i.end, from, to))}</span></button>)}</div> : <Empty>No recorded intervals. Unknown time is left empty.</Empty>; }
export function Toggle({ title, detail, checked, onChange }: {
    title: string;
    detail: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) { return <label className="setting-row"><div>{title}<small>{detail}</small></div><input className="switch" type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}/></label>; }
