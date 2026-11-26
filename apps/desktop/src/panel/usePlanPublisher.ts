import { useEffect, useMemo } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Today } from '../today/today';

export interface PlanSlot { key: string; title: string; start: number; end: number; fixed: boolean }

/** The day's open items as the pill's slots (src-tauri/src/pill.rs), keyed like the phone's Live Activity (lib/scheduledActivities.ts). */
export function planSlots(today: Today): PlanSlot[] {
  const [y, m, d] = today.day.split('-').map(Number);
  const base = new Date(y, m - 1, d).getTime();
  const at = (minute: number) => base + minute * 60_000;
  return today.items.filter(i => !i.done && i.state !== 'done').map(i => ({
    key: `${i.kind}:${i.id}${i.part ? `#${i.part.index}` : ''}:${today.day}`, title: i.title, start: at(i.start), end: at(i.end), fixed: !!i.fixed,
  }));
}

/** Sends today's plan to the pill when it changes, and again every minute (a restarted backend gets it back). */
export function usePlanPublisher(today: Today): void {
  const slots = useMemo(() => planSlots(today), [today]);
  const text = JSON.stringify(slots);
  useEffect(() => {
    if (!isTauri()) return;
    const send = () => void invoke('set_day_plan', { slots: JSON.parse(text) }).catch(() => undefined);
    send();
    const timer = setInterval(send, 60_000);
    return () => clearInterval(timer);
  }, [text]);
}
