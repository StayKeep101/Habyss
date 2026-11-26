import { useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Today } from '../today/today';
import { clockLabel, hoursLabel } from './countdown';

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * The phone's day line (components/Roadmap/DayPlanCard.tsx): waking window, time left in it, and the day's items as one
 * coloured bar with the now marker. Where the phone reads the day under a dragging finger, the Mac reads it under the
 * pointer: hovering moves the marker and shows the time, and `onRead` tells the panel which minute, so only what is set then
 * is listed. Moving off snaps it back to now.
 */
export function DayLine({ today, nowMinute, onRead }: { today: Today; nowMinute: number | null; onRead?: (minute: number | null) => void }) {
  const wake = Math.min(today.window.wake, ...today.items.map(i => i.start));
  const sleep = Math.max(today.window.sleep <= today.window.wake ? today.window.sleep + 1440 : today.window.sleep, ...today.items.map(i => i.end));
  const span = Math.max(1, sleep - wake);
  const pct = (m: number) => `${Math.max(0, Math.min(100, (m - wake) / span * 100))}%`;
  const [reading, setReading] = useState<number | null>(null);
  const last = useRef<number | null>(null);
  const lastHour = useRef<number | null>(null);
  const read = (minute: number | null) => {
    if (minute === last.current) return;
    last.current = minute;
    // A light tick on the trackpad each hour passed, so the pointer feels the clock (the phone's selectionFeedback).
    const hour = minute === null ? null : Math.floor(minute / 60);
    if (hour !== null && lastHour.current !== null && hour !== lastHour.current && isTauri()) void invoke('haptic').catch(() => undefined);
    lastHour.current = hour;
    setReading(minute);
    onRead?.(minute);
  };
  const marker = reading ?? (nowMinute !== null && nowMinute >= wake && nowMinute <= sleep ? nowMinute : null);
  const on = reading === null ? 0 : today.items.filter(i => i.start <= reading && reading < i.end).length;
  return (
    <div className="mp-dayline"
      onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); read(Math.round((wake + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * span) / 5) * 5); }}
      onMouseLeave={() => read(null)}>
      <div className="mp-dayline-head">
        {reading === null ? <>
          <span>{`${hhmm(wake)}–${hhmm(sleep)}`}</span>
          {nowMinute !== null && <b>{nowMinute < sleep ? `${hoursLabel(sleep - Math.max(nowMinute, wake))} left` : 'Day done'}</b>}
        </> : <>
          <b>{clockLabel(reading % 1440)}</b>
          <span>{on === 0 ? 'Nothing set' : on === 1 ? '1 thing set' : `${on} things set`}</span>
        </>}
      </div>
      <div className="mp-daybar" role="img" aria-label={`Awake ${hhmm(wake)} to ${hhmm(sleep)}. ${today.items.length} things today. Point along it to see what is on when.`}>
        {today.items.filter(i => i.end > wake && i.start < sleep).map(i => (
          <i key={`${i.kind}:${i.id}:${i.start}`} className={`${i.done ? 'done' : ''}${reading !== null && !(i.start <= reading && reading < i.end) ? ' dim' : ''}`}
            style={{ left: pct(i.start), width: `calc(${pct(i.end)} - ${pct(i.start)})`, background: i.color ?? 'var(--accent)' }} />
        ))}
        {marker !== null && <u className={reading !== null ? 'reading' : ''} style={{ left: pct(marker) }} />}
      </div>
    </div>
  );
}
