import type { Interval } from '../types';
import type { TodayItem } from '../today/today';

/**
 * Where the time went, as the blocks a tracked timeline shows (Chronoid-style): consecutive time in one app is one block,
 * a short interruption that comes back to the same app is folded into it (and counted as a switch), and a visit under a
 * minute joins its neighbour as one of its parts. Each block lists its parts (sites, documents, windows) with their time.
 */
export interface Block {
  key: string; app: string; bundle: string | null; domain: string | null; title: string;
  start: number; end: number; activeMs: number; category: string;
  parts: { label: string; ms: number }[];
  switches: number; typingMs: number; longestMs: number;
}

interface Seg { key: string; app: string; bundle: string | null; start: number; end: number; label: string; domain: string | null; category: string; typing: number }
interface Run { key: string; app: string; bundle: string | null; start: number; end: number; segs: Seg[]; switches: number; extra: Seg[] }

const fileName = (path: string | null | undefined) => (path ? path.split('/').filter(Boolean).pop() ?? null : null);
const dur = (r: { start: number; end: number }) => r.end - r.start;

export function mergeBlocks(intervals: Interval[], from: number, to: number, opts: { foldMs?: number; minMs?: number } = {}): Block[] {
  const foldMs = opts.foldMs ?? 120_000, minMs = opts.minMs ?? 60_000;
  const segs: Seg[] = intervals
    .filter(i => i.state === 'active' && i.end > from && i.start < to)
    .map(i => {
      const start = Math.max(i.start, from), end = Math.min(i.end, to), share = i.end > i.start ? (end - start) / (i.end - i.start) : 0;
      const app = i.name || 'Unknown';
      return { key: i.bundle_id ?? app, app, bundle: i.bundle_id, start, end, label: i.domain ?? fileName(i.document) ?? i.title ?? app, domain: i.domain, category: i.category, typing: (i.typing_ms ?? 0) * share };
    })
    .filter(s => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  // 1. Runs: consecutive time in one app (small gaps bridged).
  const runs: Run[] = [];
  for (const s of segs) {
    const last = runs[runs.length - 1];
    if (last && last.key === s.key && s.start - last.end <= foldMs) { last.end = Math.max(last.end, s.end); last.segs.push(s); }
    else runs.push({ key: s.key, app: s.app, bundle: s.bundle, start: s.start, end: s.end, segs: [s], switches: 0, extra: [] });
  }
  // 2. A short run between two runs of the same app is an interruption: the three become one.
  for (let i = 1; i < runs.length - 1;) {
    const [a, b, c] = [runs[i - 1], runs[i], runs[i + 1]];
    if (dur(b) < foldMs && a.key === c.key && b.start - a.end <= foldMs && c.start - b.end <= foldMs) {
      runs.splice(i - 1, 3, { ...a, end: Math.max(a.end, c.end), segs: [...a.segs, ...c.segs], extra: [...a.extra, ...b.segs, ...b.extra, ...c.extra], switches: a.switches + c.switches + 1 });
      i = Math.max(1, i - 1);
    } else i++;
  }
  // 3. A visit under a minute joins a neighbour that touches it.
  for (let i = 0; i < runs.length;) {
    const r = runs[i], prev = runs[i - 1], next = runs[i + 1];
    if (dur(r) >= minMs || runs.length === 1) { i++; continue; }
    const into = prev && r.start - prev.end <= foldMs ? prev : next && next.start - r.end <= foldMs ? next : null;
    if (!into) { i++; continue; }
    into.extra.push(...r.segs, ...r.extra);
    into.switches += 1;
    into.start = Math.min(into.start, r.start); into.end = Math.max(into.end, r.end);
    runs.splice(i, 1);
  }

  return runs.map(r => {
    const all = [...r.segs, ...r.extra];
    const parts = new Map<string, number>();
    for (const s of all) parts.set(s.label, (parts.get(s.label) ?? 0) + dur(s));
    const own = new Map<string, number>();
    for (const s of r.segs) own.set(s.label, (own.get(s.label) ?? 0) + dur(s));
    const cats = new Map<string, number>();
    for (const s of all) cats.set(s.category, (cats.get(s.category) ?? 0) + dur(s));
    // The longest stretch in the block's own app without switching away.
    let longest = 0, run = 0, prevEnd = -Infinity;
    for (const s of [...r.segs].sort((a, b) => a.start - b.start)) { run = s.start - prevEnd <= 1000 ? run + dur(s) : dur(s); longest = Math.max(longest, run); prevEnd = s.end; }
    const top = [...own.entries()].sort((a, b) => b[1] - a[1])[0];
    const domains = new Set(r.segs.map(s => s.domain));
    return {
      key: `${r.key}:${r.start}`, app: r.app, bundle: r.bundle, domain: domains.size === 1 ? [...domains][0] : null, title: top?.[0] ?? r.app,
      start: r.start, end: r.end, activeMs: all.reduce((n, s) => n + dur(s), 0), category: [...cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'uncategorized',
      parts: [...parts.entries()].map(([label, ms]) => ({ label, ms })).sort((a, b) => b.ms - a.ms),
      switches: r.switches, typingMs: all.reduce((n, s) => n + s.typing, 0), longestMs: longest,
    };
  });
}

/** The planned habit or task the block overlaps the longest on `day` (display only: it never ticks anything). */
export function matchItem(block: Block, items: TodayItem[], day: string): TodayItem | null {
  const [y, m, d] = day.split('-').map(Number);
  const base = new Date(y, m - 1, d).getTime();
  let best: TodayItem | null = null, most = 0;
  for (const i of items) {
    if (i.kind !== 'habit' && i.kind !== 'task') continue;
    const overlap = Math.min(block.end, base + i.end * 60_000) - Math.max(block.start, base + i.start * 60_000);
    if (overlap > most) { most = overlap; best = i; }
  }
  return best;
}
