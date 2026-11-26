import { useMemo, useRef, useState } from 'react';
import type { Interval } from '../types';
import type { TodayItem } from '../today/today';
import { duration } from '../analytics';
import { liveIntervals } from '../tracking/usage';
import { matchItem, mergeBlocks, type Block } from '../tracking/blocks';
import { AppLogo } from '../ui';
import type { Axis } from './axis';
import { clockLabel } from './countdown';

type Class = 'productive' | 'neutral' | 'unproductive';

/**
 * Quick hops between apps (each under `shortMs`, a minute or two apart) are one stretch of switching, named by the apps
 * in it ("Mail, Slack +2") with each one's time inside, rather than a stack of slivers too thin to read.
 */
export function clusterShort(blocks: Block[], shortMs = 8 * 60_000, gapMs = 3 * 60_000): Block[] {
  const out: Block[] = [];
  let run: Block[] = [];
  const flush = () => {
    if (run.length > 1) {
      const byApp = new Map<string, number>();
      for (const b of run) byApp.set(b.domain ?? b.app, (byApp.get(b.domain ?? b.app) ?? 0) + b.activeMs);
      const parts = [...byApp].map(([label, ms]) => ({ label, ms })).sort((a, b) => b.ms - a.ms);
      const byCat = new Map<string, number>();
      for (const b of run) byCat.set(b.category, (byCat.get(b.category) ?? 0) + b.activeMs);
      const names = parts.map(p => p.label);
      out.push({
        key: `switching:${run[0].key}:${run[0].start}`, app: 'Switching', bundle: null, domain: null,
        title: names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', '),
        start: run[0].start, end: run[run.length - 1].end, activeMs: run.reduce((t, b) => t + b.activeMs, 0),
        category: [...byCat].sort((a, b) => b[1] - a[1])[0][0], parts,
        switches: run.length - 1 + run.reduce((t, b) => t + b.switches, 0), typingMs: run.reduce((t, b) => t + b.typingMs, 0),
        longestMs: Math.max(...run.map(b => b.longestMs)),
      });
    } else out.push(...run);
    run = [];
  };
  for (const b of blocks) {
    const short = b.end - b.start < shortMs, last = run[run.length - 1];
    if (short && (!last || b.start - last.end <= gapMs)) run.push(b);
    else { flush(); if (short) run.push(b); else out.push(b); }
  }
  flush();
  return out;
}
const MIN_HEIGHT = 3, LINE_HEIGHT = 12, FULL_HEIGHT = 26;

/** Where the time went, on the shared axis: one block per stretch (Chronoid-style), its icon, title, length and main parts,
 * a strip coloured by productivity, and a detail card on hover or keyboard focus. */
export function TrackedTimeline({ intervals, axis, day, items, classes, now }: {
  intervals: Interval[]; axis: Axis; day: string; items: TodayItem[]; classes: Record<string, Class>; now: number | null;
}) {
  const [y, m, d] = day.split('-').map(Number);
  const base = new Date(y, m - 1, d).getTime();
  const from = base + axis.from * 60_000, to = base + axis.to * 60_000;
  const blocks = useMemo(() => clusterShort(mergeBlocks(now ? liveIntervals(intervals, now) : intervals, from, to)), [intervals, now, from, to]);
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteOf = (ms: number) => (ms - base) / 60_000;
  const hover = (key: string | null, wait: number) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(key), wait); };
  if (!blocks.length) return <div className="mp-tracked" style={{ height: axis.height }}><p className="mp-empty mp-tracked-empty">Fills in as you use your Mac</p></div>;
  return (
    <div className="mp-tracked" style={{ height: axis.height }} onMouseLeave={() => hover(null, 0)}>
      {blocks.map(b => {
        const top = axis.y(minuteOf(b.start)), height = Math.max(MIN_HEIGHT, (b.end - b.start) / 60_000 * axis.pxPerMin);
        const cls = classes[b.category] ?? 'neutral', shown = open === b.key, lines = Math.max(0, Math.floor((height - 26) / 18));
        return (
          <div key={b.key} className="mp-block-wrap">
            <i className={`mp-strip ${cls}`} style={{ top, height }} aria-hidden="true" />
            <button type="button" className={`mp-block ${cls}${height < FULL_HEIGHT ? ' thin' : ''}${height < LINE_HEIGHT ? ' sliver' : ''}`} style={{ top, height }} aria-label={`${b.title}, ${b.app}, ${duration(b.activeMs)}`} aria-describedby={shown ? `card-${b.key}` : undefined}
              onMouseEnter={() => hover(b.key, 150)} onFocus={() => setOpen(b.key)} onBlur={() => setOpen(null)}>
              <span className="mp-block-head">{b.app === 'Switching' ? <i className="mp-switch-mark" aria-hidden="true" /> : <AppLogo name={b.domain ?? b.app} bundle={b.domain ? null : b.bundle} domain={b.domain} size={14} />}<b>{b.title}</b><em>{duration(b.activeMs)}</em></span>
              {b.parts.filter(p => p.label !== b.title).slice(0, Math.min(3, lines)).map(p => <span key={p.label} className="mp-block-part"><span>{p.label}</span><em>{duration(p.ms)}</em></span>)}
            </button>
            {shown && <BlockCard id={`card-${b.key}`} top={top} block={b} match={matchItem(b, items, day)} cls={cls} />}
          </div>
        );
      })}
      {now !== null && now >= from && now <= to && <div className="mp-nowline" style={{ top: axis.y(minuteOf(now)) }} aria-hidden="true" />}
    </div>
  );
}

function BlockCard({ id, top, block: b, match, cls }: { id: string; top: number; block: Block; match: TodayItem | null; cls: Class }) {
  const t = (ms: number) => { const d = new Date(ms); return clockLabel(d.getHours() * 60 + d.getMinutes()); };
  const deep = b.activeMs ? Math.round(b.longestMs / b.activeMs * 100) : 0;
  return (
    <div id={id} role="tooltip" className="mp-card-pop" style={{ top }}>
      <strong>{b.title}</strong>
      <small>{b.app} · {t(b.start)} – {t(b.end)}</small>
      <dl>
        <dt>Active</dt><dd>{duration(b.activeMs)}</dd>
        <dt>Switches</dt><dd>{b.switches}</dd>
        <dt>Typing</dt><dd>{duration(b.typingMs)}</dd>
        <dt>Longest stretch</dt><dd>{duration(b.longestMs)}</dd>
        <dt>Plan</dt><dd>{match ? `Matched: ${match.title}` : 'Not planned'}</dd>
        <dt>Category</dt><dd>{b.category} · {cls}</dd>
      </dl>
      <div className="mp-deep" aria-label={`${deep}% unbroken`}><i style={{ width: `${deep}%` }} /></div>
      {b.parts.length > 1 && <ul>{b.parts.slice(0, 5).map(p => <li key={p.label}><span>{p.label}</span><em>{duration(p.ms)}</em></li>)}</ul>}
    </div>
  );
}
