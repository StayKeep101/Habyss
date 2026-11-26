import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CloudData, CompletionRow, FocusSession, Snapshot } from '../types';
import { dayRange, FOCUS_MINUTES } from '../analytics';
import { buildDay, memoryAfter, type TodayItem } from '../today/today';
import { useFastClock, useSharedCloud, WithCloud } from '../today/CloudProvider';
import { localDateKey } from '../shared/habitSchedule';
import { Button, Segmented } from '../ui';
import { NowCard, nowState } from './NowCard';
import { WeekRow } from './WeekRow';
import { DayLine } from './DayLine';
import { hourMarks, makeAxis, type Axis } from './axis';
import { clockLabel } from './countdown';
import { usePlanPublisher } from './usePlanPublisher';
import { PlannedTimeline } from './PlannedTimeline';
import { PlannedList } from './PlannedList';
import { TrackedTimeline } from './TrackedTimeline';
import { QuickAdd } from './QuickAdd';
import { LiveActivityTip } from './LiveActivityTip';
import { rowToHabit } from '../shared/rows';
import { measurementFor } from '../shared/habitMeasurement';
import './menuPanel.css';

export type PlanView = 'Timeline' | 'List';
export type Show = 'Both' | 'Plan' | 'Tracked';

/** The day shown: the one picked, else today (so the panel moves to the new day at midnight on its own). */
export const shownDate = (picked: string | null, now: Date): string => picked ?? localDateKey(now);
/** Monday to Sunday around `day`. */
export function weekOf(day: string): string[] {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d), monday = d - ((date.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => localDateKey(new Date(y, m - 1, monday + i)));
}

const read = <T,>(key: string, fallback: T, ok: (v: unknown) => boolean): T => { try { const v = JSON.parse(localStorage.getItem(key) ?? 'null'); return ok(v) ? v as T : fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* per-viewer convenience only */ } };

/** A tick shown at once, before the server confirms it (it is reverted by a refresh if the save fails). */
export const tickHabit = (d: CloudData, habitId: string, date: string, value: number | null, at: string): CloudData => {
  const on = value !== null;
  const has = d.completions.some(c => c.habit_id === habitId && c.date === date);
  if (has) return { ...d, completions: d.completions.map(c => (c.habit_id === habitId && c.date === date ? { ...c, deleted: on ? 0 : 1, skipped: 0, value, created_at: on && c.deleted ? at : c.created_at } : c)) };
  if (!on) return d;
  const row: CompletionRow = { id: `local-${habitId}-${date}`, user_id: null, habit_id: habitId, date, value, memo: null, created_at: at, updated_at: at, evidence: null, skipped: 0, deleted: 0, synced: 0, owner_id: null, refused: 0 };
  return { ...d, completions: [...d.completions, row] };
};

/** The menu bar panel: the phone's Today on the left, where the time actually went on the right, on one clock. */
export function MenuPanel() {
  return <WithCloud><Panel /></WithCloud>;
}

function Panel() {
  const { cloud, signedIn, statusLoading, now, minute } = useSharedCloud();
  useFastClock(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [planView, setPlanView] = useState<PlanView>(() => read('habyss.panel.planView', 'Timeline', v => v === 'Timeline' || v === 'List'));
  const [show, setShow] = useState<Show>(() => read('habyss.panel.show', 'Both', v => v === 'Both' || v === 'Plan' || v === 'Tracked'));
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const nowDate = useMemo(() => new Date(minute), [minute]);
  const todayKey = localDateKey(nowDate);
  const date = shownDate(picked, nowDate);

  const loadSnap = useCallback(async () => {
    if (!isTauri()) return;
    const [from, to] = dayRange(date);
    try { setSnap(await invoke<Snapshot>('snapshot', { from, to })); } catch (e) { setError(String(e)); }
  }, [date]);
  useEffect(() => {
    void loadSnap();
    let dispose: (() => void) | undefined, cancelled = false;
    void listen('activity-updated', () => void loadSnap()).then(f => { if (cancelled) f(); else dispose = f; });
    return () => { cancelled = true; dispose?.(); };
  }, [loadSnap]);

  const day = useMemo(() => buildDay(cloud.data, { date, now: nowDate, signedIn }), [cloud.data, date, nowDate, signedIn]);
  const today = useMemo(() => (date === todayKey ? day : buildDay(cloud.data, { date: todayKey, now: nowDate, signedIn })), [cloud.data, date, todayKey, day, nowDate, signedIn]);
  const week = useMemo(() => weekOf(date), [date]);
  const shares = useMemo(() => Object.fromEntries(week.map(d => { const t = d === date ? day : buildDay(cloud.data, { date: d, now: nowDate, signedIn }); return [d, t.total ? t.done / t.total : 0]; })), [week, date, day, cloud.data, nowDate, signedIn]);
  usePlanPublisher(today);

  // Today's layout is remembered, as the phone does, so both keep the same line (lib/dayMemory.ts). Once a minute at most.
  const remembered = useRef('');
  useEffect(() => {
    if (!signedIn || !cloud.data || !isTauri()) return;
    const next = memoryAfter(cloud.data, todayKey, nowDate);
    const text = next ? JSON.stringify(next) : '';
    if (!next || text === remembered.current) return;
    remembered.current = text;
    void invoke('cloud_set_day_input', { key: `day_memory:${todayKey}`, value: next }).catch(() => undefined);
  }, [cloud.data, todayKey, nowDate, signedIn]);

  const running: FocusSession | null = snap?.focus.find(f => f.end === null) ?? null;
  const run = async (cmd: string, args?: Record<string, unknown>, revert = false): Promise<boolean> => {
    try { await invoke(cmd, args); setError(''); return true; } catch (e) { setError(String(e)); if (revert) await cloud.refresh(); return false; }
  };
  const focusCmd = async (cmd: string, args?: Record<string, unknown>) => { await run(cmd, args); await loadSnap(); };
  /** Ticks (or unticks) a habit or task on the shown day; `value` is a habit's amount (1 for done/not done). */
  const setDone = (item: TodayItem, on: boolean, value = 1) => {
    const at = new Date().toISOString();
    if (item.kind === 'habit') {
      cloud.setLocal(d => tickHabit(d, item.id, date, on ? value : null, at));
      void run('cloud_set_completion', { habitId: item.id, date, value: on ? value : null, skipped: false, memo: null, evidence: null }, true);
    } else if (item.kind === 'task') {
      cloud.setLocal(d => ({ ...d, tasks: d.tasks.map(t => (t.id === item.id ? { ...t, status: on ? 'done' : 'open', completed_at: on ? at : null } : t)) }));
      void run('cloud_set_task_done', { id: item.id, done: on }, true);
    }
  };

  const state = nowState(today, running, now);
  /** An amount habit's unit and target ("30 pages"), so its check asks how much; null for done / not done. */
  const amountFor = useCallback((item: TodayItem) => {
    const row = cloud.data?.habits.find(h => h.id === item.id);
    if (!row) return null;
    const m = measurementFor(rowToHabit(row));
    return m.kind === 'boolean' ? null : { unit: m.unit, target: m.target };
  }, [cloud.data]);
  const axis = useMemo(() => makeAxis(day.window.wake, day.window.sleep), [day.window.wake, day.window.sleep]);
  const apps = useMemo(() => { const seen = new Map<string, { name: string; bundle: string | null }>(); for (const i of snap?.intervals ?? []) if (i.state === 'active' && i.name && !seen.has(i.name)) seen.set(i.name, { name: i.name, bundle: i.bundle_id }); return [...seen.values()]; }, [snap]);
  const nowMinute = date === todayKey ? nowDate.getHours() * 60 + nowDate.getMinutes() : null;
  // Both timelines open scrolled to now (or, on another day, to its first item), each time the panel is shown.
  const cols = useRef<HTMLDivElement>(null);
  const focusMinute = nowMinute ?? day.items[0]?.start ?? day.window.wake;
  const scrollToNow = useCallback(() => {
    const el = cols.current;
    if (!el) return;
    el.scrollTop = Math.max(0, axis.y(focusMinute) - 120);
    el.dataset.scrolledTo = String(focusMinute);
  }, [axis, focusMinute]);
  const scrolledFor = useRef('');
  useEffect(() => { const key = `${date}:${axis.from}`; if (scrolledFor.current !== key) { scrolledFor.current = key; scrollToNow(); } }, [date, axis.from, scrollToNow]);
  useEffect(() => { window.addEventListener('focus', scrollToNow); return () => window.removeEventListener('focus', scrollToNow); }, [scrollToNow]);
  const planner = statusLoading || cloud.loading ? <p className="mp-empty">Loading…</p> : !signedIn ? <SignIn /> : null;
  const choosePlan = (v: PlanView) => { setPlanView(v); write('habyss.panel.planView', v); };
  const chooseShow = (v: Show) => { setShow(v); write('habyss.panel.show', v); };

  return (
    <div className="mp">
      <LiveActivityTip />
      <NowCard state={state} onCheck={item => setDone(item, true)}
        onStartFocus={item => void focusCmd('start_focus', { label: item?.title ?? 'Focus', minutes: FOCUS_MINUTES, itemId: item && (item.kind === 'habit' || item.kind === 'task') ? item.id : null, itemKind: item && (item.kind === 'habit' || item.kind === 'task') ? item.kind : null })}
        onPause={() => void focusCmd('pause_focus')} onResume={() => void focusCmd('resume_focus')} onStop={() => void focusCmd('stop_focus')} />
      <WeekRow days={week} today={todayKey} shown={date} share={d => shares[d] ?? 0} onPick={d => setPicked(d === todayKey ? null : d)} />
      <DayLine today={day} nowMinute={nowMinute} />
      <div className="mp-tools">
        <Segmented options={['Timeline', 'List'] as PlanView[]} value={planView} onChange={choosePlan} />
        <QuickAdd date={date} apps={apps} run={(cmd, args) => run(cmd, args)} onSaved={() => { void cloud.refresh(); void loadSnap(); }} />
        <Segmented options={['Both', 'Plan', 'Tracked'] as Show[]} value={show} onChange={chooseShow} />
      </div>
      {(error || (cloud.error && signedIn)) && <p role="alert" className="mp-error">{error || cloud.error}</p>}
      <div ref={cols} className={`mp-cols show-${show.toLowerCase()}`}>
        {show !== 'Tracked' && <Column label="Planned">{planner ?? (planView === 'Timeline'
          ? <PlannedTimeline day={day} axis={axis} now={date === todayKey ? now : null} amountFor={amountFor} onToggle={(item, on, value) => setDone(item, on, value)} />
          : <PlannedList day={day} onToggle={(item, on, value) => setDone(item, on, value)} onSeeAll={() => void invoke('open_dashboard', { screen: 'Calendar' })} />)}</Column>}
        {show === 'Both' && <Hours axis={axis} />}
        {show !== 'Plan' && <Column label="Tracked"><TrackedTimeline intervals={snap?.intervals ?? []} axis={axis} day={date} items={day.items} classes={snap?.classifications ?? {}} now={date === todayKey ? now : null} /></Column>}
      </div>
    </div>
  );
}

function Column({ label, children }: { label: string; children: ReactNode }) {
  return <section className="mp-col" aria-label={label}><h2 className="mp-col-head">{label}</h2>{children}</section>;
}
function Hours({ axis }: { axis: Axis }) {
  return <div className="mp-hours" aria-hidden="true" style={{ height: axis.height }}>{hourMarks(axis).map(m => <span key={m} style={{ top: axis.y(m) }}>{clockLabel(m).replace(':00', '')}</span>)}</div>;
}
function SignIn() {
  return <div className="mp-signin"><p>Sign in to see your habits and tasks.</p><Button variant="quiet" onClick={() => void invoke('open_dashboard', { screen: 'Settings' })}>Open Settings</Button></div>;
}
