import { overlap } from '../analytics';
import type { Interval } from '../types';

/** How far the live span may run ahead of the last snapshot. The backend refreshes every 5 s, so a stall stops the count. */
const LIVE_LEAD_MS = 10_000;

/** Extends the running active span to `now`, so totals count up between snapshots like a stopwatch. */
export function liveIntervals(intervals: Interval[], now: number): Interval[] {
  return intervals.map(i => i.id === 'current' && i.state === 'active' && now > i.end ? { ...i, end: Math.min(now, i.end + LIVE_LEAD_MS) } : i);
}

export interface Detail { key: string; label: string; ms: number; domain: string | null }
export interface Usage {
  key: string; name: string; bundle: string | null; domain: string | null; category: string;
  ms: number; sessions: number; lastSeen: number; live: boolean;
  typing: number; pointer: number; details: Detail[];
}

/**
 * One row per app (or per website), totals clipped to [from, to). Each row lists what was inside it: for a browser
 * its sites, otherwise its documents or window titles, merged by name so a hundred spans of one file read as one line.
 */
export function groupUsage(intervals: Interval[], from: number, to: number, by: 'app' | 'site' = 'app'): Usage[] {
  const groups = new Map<string, Usage & { parts: Map<string, Detail> }>();
  for (const i of intervals) {
    if (i.state !== 'active') continue;
    const ms = overlap(i.start, i.end, from, to);
    if (ms <= 0) continue;
    if (by === 'site' && !i.domain) continue;
    const key = by === 'site' ? i.domain! : i.bundle_id ?? i.name;
    const g = groups.get(key) ?? { key, name: by === 'site' ? i.domain! : i.name || 'Unknown', bundle: by === 'site' ? null : i.bundle_id, domain: by === 'site' ? i.domain : null, category: i.category, ms: 0, sessions: 0, lastSeen: 0, live: false, typing: 0, pointer: 0, details: [], parts: new Map() };
    const share = i.end > i.start ? ms / (i.end - i.start) : 0;
    g.ms += ms; g.sessions++; g.lastSeen = Math.max(g.lastSeen, i.end); g.live ||= i.id === 'current';
    g.typing += (i.typing_ms ?? 0) * share; g.pointer += (i.pointer_ms ?? 0) * share;
    // The most recent span decides the row's category (a site's category can differ from its browser's).
    if (i.end >= g.lastSeen) g.category = i.category;
    const label = by === 'site' ? i.url?.replace(/^https?:\/\/[^/]+/, '') || '/' : i.domain ?? fileName(i.document) ?? i.title;
    if (label) {
      const d = g.parts.get(label) ?? { key: label, label, ms: 0, domain: by === 'app' ? i.domain : null };
      d.ms += ms; g.parts.set(label, d);
    }
    groups.set(key, g);
  }
  return [...groups.values()].map(({ parts, ...g }) => ({ ...g, details: [...parts.values()].sort((a, b) => b.ms - a.ms) })).sort((a, b) => b.ms - a.ms);
}
function fileName(path: string | null | undefined): string | null { return path ? path.split('/').filter(Boolean).pop() ?? null : null; }
