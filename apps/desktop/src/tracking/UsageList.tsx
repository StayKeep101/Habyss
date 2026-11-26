import { useEffect, useMemo, useState } from 'react';
import { duration } from '../analytics';
import type { Interval } from '../types';
import { AppLogo, Empty, Tag } from '../ui';
import { groupUsage, liveIntervals } from './usage';

type Class = 'productive' | 'neutral' | 'unproductive';
/** Seconds once under an hour, so the live row visibly ticks; minutes after. */
function clockish(ms: number) { const s = Math.floor(ms / 1000); return s < 3600 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : duration(ms); }

/** A 1 s clock, running only while something is live. */
function useTick(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!on) return; setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [on]);
  return now;
}

/** Apps (or websites) ranked by time, each a single row whose total counts up while it is in front. Rows expand into what was inside them. */
export function UsageList({ intervals, from, to, by = 'app', classes = {}, limit, empty = 'No activity recorded yet.', compact = false }: {
  intervals: Interval[]; from: number; to: number; by?: 'app' | 'site'; classes?: Record<string, Class>; limit?: number; empty?: string; compact?: boolean;
}) {
  const hasLive = intervals.some(i => i.id === 'current' && i.state === 'active');
  const now = useTick(hasLive);
  const rows = useMemo(() => groupUsage(hasLive ? liveIntervals(intervals, now) : intervals, from, Math.max(to, hasLive ? Math.min(now, to) : to), by), [intervals, from, to, by, now, hasLive]);
  const [open, setOpen] = useState<string | null>(null);
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const top = rows[0].ms || 1;
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <ul className={`usage${compact ? ' compact' : ''}`}>
      {shown.map(r => {
        const expanded = open === r.key && r.details.length > 0;
        return (
          <li key={r.key} className={`usage-item${r.live ? ' live' : ''}${expanded ? ' open' : ''}`}>
            <button type="button" className="usage-main" aria-expanded={r.details.length ? expanded : undefined} disabled={r.details.length === 0} onClick={() => setOpen(expanded ? null : r.key)}>
              <AppLogo name={r.name} bundle={r.bundle} domain={r.domain} size={compact ? 26 : 30} />
              <span className="usage-text">
                <span className="usage-name">{r.name}{r.live && <i className="usage-dot" title="In use now" />}</span>
                <span className="usage-bar" aria-hidden="true"><span style={{ width: `${Math.max(2, r.ms / top * 100)}%` }} /></span>
              </span>
              <Tag tone={classes[r.category] ?? 'neutral'} />
              <span className="usage-ms">{r.live ? clockish(r.ms) : duration(r.ms)}</span>
            </button>
            {expanded && (
              <ul className="usage-details">
                {r.details.slice(0, 8).map(d => (
                  <li key={d.key}>
                    {d.domain ? <AppLogo name={d.domain} domain={d.domain} size={16} /> : <span className="usage-detail-pad" />}
                    <span className="usage-detail-label" title={d.label}>{d.label}</span>
                    <span className="usage-detail-ms">{duration(d.ms)}</span>
                  </li>))}
                {!compact && (r.typing > 0 || r.pointer > 0) && <li className="usage-input">Typing {duration(r.typing)} · Mouse {duration(r.pointer)} · {r.sessions} {r.sessions === 1 ? 'visit' : 'visits'}</li>}
              </ul>)}
          </li>);
      })}
    </ul>
  );
}
