import type { Interval } from '../types';
import { appColor, colors, dayRange, duration, localDate, metrics, overlap } from '../analytics';
import { Empty, clock } from './ui';
import { AppLogo } from '../ui';
export function ActivityChart({ intervals, from, to }: {
    intervals: Interval[];
    from: number;
    to: number;
}) { const hours = Math.round((to - from) / 3600000); const values = Array.from({ length: hours }, (_, h) => intervals.filter(i => i.state === 'active').reduce((s, i) => s + overlap(i.start, i.end, from + h * 3600000, from + (h + 1) * 3600000), 0) / 60000); return <div className="hour-chart" role="img" aria-label={`Hourly active minutes: ${values.map((v, h) => `${new Date(from + h * 3600000).getHours()}:00 ${Math.round(v)}`).join(', ')}`}><div className="chart-grid"><span>60m</span><span>30m</span><span>0</span></div><div className="chart-bars">{values.map((v, h) => <div key={h} className="hour-column"><div className="bar-track"><div className="bar" style={{ height: `${v / 60 * 100}%` }} title={`${clock(from + h * 3600000)} · ${Math.round(v)} active minutes`}/></div><small>{h % 3 === 0 ? new Date(from + h * 3600000).getHours().toString().padStart(2, '0') : ''}</small></div>)}</div></div>; }
export function WeeklyChart({ intervals, to }: {
    intervals: Interval[];
    to: number;
}) { const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(to); d.setDate(d.getDate() - 7 + i); const [a, b] = dayRange(localDate(d)); return { label: d.toLocaleDateString([], { weekday: 'short' }), ms: metrics(intervals, [], a, b).active }; }); const max = Math.max(3600000, ...days.map(d => d.ms)); return <div className="weekly-chart">{days.map((d, i) => <div key={i}><span>{duration(d.ms)}</span><div className="weekly-track"><div style={{ height: `${100 * d.ms / max}%` }}/></div><small>{d.label}</small></div>)}</div>; }
export function AppUsage({ apps, total }: {
    apps: ReturnType<typeof metrics>['apps'];
    total: number;
}) { return apps.length ? <div className="usage-list">{apps.map(a => <div className="usage-row" key={a.bundle}><AppLogo name={a.name} bundle={a.bundle}/><div className="usage-content"><div><strong>{a.name}</strong><span>{duration(a.ms)}</span></div><div className="usage-track"><div style={{ width: `${total ? a.ms / total * 100 : 0}%`, background: appColor(a.name) }}/></div></div></div>)}</div> : <Empty>No activity recorded for this date yet.</Empty>; }
export function CategoryChart({ categories: items, total }: {
    categories: [
        string,
        number
    ][];
    total: number;
}) { let offset = 0; return items.length ? <div className="category-layout"><div className="donut"><svg viewBox="0 0 120 120" aria-label="Category distribution" role="img"><circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" strokeWidth="10"/>{items.map(([c, n], i) => { const dash = n / total * 301.59; const el = <circle key={c} cx="60" cy="60" r="48" fill="none" stroke={colors[i % colors.length]} strokeWidth="10" strokeDasharray={`${dash} ${301.59 - dash}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)"/>; offset += dash; return el; })}</svg><div><strong>{duration(total)}</strong><small>active time</small></div></div><div className="category-legend">{items.map(([c, n], i) => <div key={c}><i style={{ background: colors[i % colors.length] }}/><span>{c}</span><strong>{Math.round(n / total * 100)}%</strong></div>)}</div></div> : <Empty>Categories appear with your recorded activity.</Empty>; }
