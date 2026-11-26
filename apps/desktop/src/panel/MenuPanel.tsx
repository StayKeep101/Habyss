import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CloudData, CompletionRow, FocusSession, Settings, Snapshot } from '../types';
import { dayRange } from '../analytics';
import { buildDay, memoryAfter, type TodayItem } from '../today/today';
import { useFastClock, useSharedCloud, WithCloud } from '../today/CloudProvider';
import { localDateKey } from '../shared/habitSchedule';
import { AppIcon, Button } from '../ui';
import { NowCard, nowState } from './NowCard';
import { WeekRow, monthDays, shiftDay } from './WeekRow';
import { DayLine } from './DayLine';
import { hourMarks, makeAxis, type Axis } from './axis';
import { clockLabel } from './countdown';
import { usePlanPublisher } from './usePlanPublisher';
import { PlannedTimeline } from './PlannedTimeline';
import { PlannedList } from './PlannedList';
import { TrackedTimeline } from './TrackedTimeline';
import { QuickAdd, type AddMode } from './QuickAdd';
import { AmountEntry } from './AmountEntry';
import { useSwipe } from './swipe';
import { LiveActivityTip } from './LiveActivityTip';
import { rowToHabit } from '../shared/rows';
import { measurementFor } from '../shared/habitMeasurement';
import './menuPanel.css';

export type PlanView = 'Timeline' | 'List';
/** The panel's scale: fifteen minutes is a full planned row, so rows sit at their real time beside the tracked side. */
export const PX_PER_MIN = 2.4;

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
  const [month, setMonth] = useState(false);
  const [adding, setAdding] = useState<AddMode | null>(null);
  const [reading, setReading] = useState<number | null>(null);
  const [askingNow, setAskingNow] = useState<TodayItem | null>(null);
  const [options, setOptions] = useState(false);
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
  const week = useMemo(() => (month ? monthDays(date) : weekOf(date)), [date, month]);
  const shares = useMemo(() => Object.fromEntries(week.map(d => { const t = d === date ? day : buildDay(cloud.data, { date: d, now: nowDate, signedIn }); return [d, t.total ? t.done / t.total : 0]; })), [week, date, day, cloud.data, nowDate, signedIn]);
  usePlanPublisher(today);

  // Today's layout is remembered, as the phone does (lib/dayMemory.ts), under the Mac's own key unless the phone already
  // laid the day out (buildDay.ts memoryAfter). Never before the account's data has loaded.
  const remembered = useRef('');
  useEffect(() => {
    if (!signedIn || !cloud.data || cloud.loading || !isTauri()) return;
    const next = memoryAfter(cloud.data, todayKey, nowDate);
    const text = next ? JSON.stringify(next) : '';
    if (!next || text === remembered.current) return;
    remembered.current = text;
    void invoke('cloud_set_day_input', { key: next.key, value: next.memory }).catch(() => undefined);
  }, [cloud.data, cloud.loading, todayKey, nowDate, signedIn]);

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
  // Waking to bedtime, widened to take in anything planned or tracked outside them (time at 6 am, a late task).
  const axis = useMemo(() => {
    const [y, mo, d] = date.split('-').map(Number), base = new Date(y, mo - 1, d).getTime();
    const tracked = (snap?.intervals ?? []).filter(i => i.state === 'active').map(i => ({ start: Math.floor((i.start - base) / 60000), end: Math.ceil((i.end - base) / 60000) }));
    const spans = [...day.items.map(i => ({ start: i.start, end: i.end })), ...tracked].filter(r => r.end > 0 && r.start < 2 * 1440 && r.end > r.start);
    return makeAxis(day.window.wake, day.window.sleep, PX_PER_MIN, spans);
  }, [date, snap, day]);
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
  const choosePlan = useCallback((v: PlanView) => { setPlanView(v); write('habyss.panel.planView', v); }, []);
  const openApp = useCallback((screen?: string) => void invoke('open_dashboard', { screen: screen ?? null }).catch(() => undefined), []);
  /** Done from the Now card: an amount habit asks how much first, as everywhere else. */
  const checkNow = (item: TodayItem) => { if (item.kind === 'habit' && amountFor(item)) setAskingNow(item); else setDone(item, true); };
  const setMenuBar = (patch: Partial<Pick<Settings, 'menu_bar_timer' | 'menu_bar_task'>>) => {
    if (!snap) return;
    const settings = { ...snap.settings, ...patch };
    setSnap({ ...snap, settings });
    void run('save_settings', { settings });
  };
  // Timeline and List side by side, one swipe apart, as the phone's pager.
  const swipePlan = useSwipe(d => { if (d === 'left' && planView === 'Timeline') choosePlan('List'); else if (d === 'right' && planView === 'List') choosePlan('Timeline'); else return false; }, 'x');

  // The keyboard does what buttons used to: T, H, L add; 1 and 2 switch views; arrows move by a day; M opens the month;
  // ⌘O opens the app, ⌘, its settings. Never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest('input, textarea, select, [contenteditable]') !== null);
      if (e.metaKey && !e.altKey && !e.ctrlKey) {
        if (e.key === 'o') { e.preventDefault(); openApp(); }
        else if (e.key === ',') { e.preventDefault(); openApp('Settings'); }
        return;
      }
      if (e.key === 'Escape') { if (adding) setAdding(null); else if (month) setMonth(false); else if (options) setOptions(false); else if (picked) setPicked(null); return; }
      if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key.toLowerCase();
      if (signedIn && (key === 't' || key === 'h')) { e.preventDefault(); setAdding(key === 't' ? 'task' : 'habit'); }
      else if (key === 'l') { e.preventDefault(); setAdding('time'); }
      else if (key === '1') choosePlan('Timeline');
      else if (key === '2') choosePlan('List');
      else if (key === 'm') setMonth(m => !m);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const next = shiftDay(date, e.key === 'ArrowLeft' ? -1 : 1); setPicked(next === todayKey ? null : next); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adding, month, options, picked, signedIn, date, todayKey, openApp, choosePlan]);

  return (
    <div className="mp">
      <LiveActivityTip />
      <NowCard state={state} onCheck={checkNow} onOpen={() => openApp()}
        onPause={() => void focusCmd('pause_focus')} onResume={() => void focusCmd('resume_focus')} onStop={() => void focusCmd('stop_focus')} />
      {askingNow && (() => { const a = amountFor(askingNow); return a ? <div className="mp-now-amount"><AmountEntry title={askingNow.title} unit={a.unit} target={a.target} onCancel={() => setAskingNow(null)} onSave={v => { setDone(askingNow, true, v); setAskingNow(null); }} /></div> : null; })()}
      <WeekRow days={week} today={todayKey} shown={date} share={d => shares[d] ?? 0} onPick={d => setPicked(d === todayKey ? null : d)} month={month} onMonth={setMonth} />
      {!month && <DayLine today={day} nowMinute={nowMinute} onRead={setReading} />}
      <QuickAdd mode={adding} onClose={() => setAdding(null)} date={date} apps={apps} run={(cmd, args) => run(cmd, args)} onSaved={() => { void cloud.refresh(); void loadSnap(); }} />
      {(error || (cloud.error && signedIn)) && <p role="alert" className="mp-error">{error || cloud.error}</p>}
      <div ref={cols} className="mp-cols" onWheel={swipePlan}>
        <Column label="Planned" aside={<Pages value={planView} onChange={choosePlan} />}>{planner ?? (planView === 'Timeline'
          ? <PlannedTimeline day={day} axis={axis} now={date === todayKey ? now : null} at={reading} amountFor={amountFor} onToggle={(item, on, value) => setDone(item, on, value)} />
          : <PlannedList day={day} at={reading} amountFor={amountFor} onToggle={(item, on, value) => setDone(item, on, value)} onSeeAll={() => openApp('Calendar')} />)}</Column>
        <Hours axis={axis} />
        <Column label="Tracked"><TrackedTimeline intervals={snap?.intervals ?? []} axis={axis} day={date} items={day.items} classes={snap?.classifications ?? {}} now={date === todayKey ? now : null} /></Column>
      </div>
      <footer className="mp-foot">
        <span className="mp-keys" aria-label="Shortcuts: T new task, H new habit, L log time, 1 and 2 timeline or list">
          {signedIn && <><kbd>T</kbd> Task <kbd>H</kbd> Habit </>}<kbd>L</kbd> Log time
        </span>
        <button type="button" className="mp-foot-button" aria-label="Menu bar options" aria-expanded={options} onClick={() => setOptions(o => !o)}><AppIcon name="options" size={16} /></button>
        <button type="button" className="mp-foot-button" onClick={() => openApp()} title="⌘O"><AppIcon name="open" size={16} />Open Habyss</button>
        {options && snap && <MenuBarOptions settings={snap.settings} onChange={setMenuBar} onMore={() => openApp('Settings')} />}
      </footer>
    </div>
  );
}

/** The menu bar's own look, from the panel: the countdown, the name of what is on, or the mark alone. */
function MenuBarOptions({ settings, onChange, onMore }: { settings: Settings; onChange: (patch: Partial<Pick<Settings, 'menu_bar_timer' | 'menu_bar_task'>>) => void; onMore: () => void }) {
  const row = (label: string, on: boolean, key: 'menu_bar_timer' | 'menu_bar_task') => (
    <label className="mp-option"><span>{label}</span><input type="checkbox" className="switch" checked={on} onChange={e => onChange({ [key]: e.target.checked })} /></label>
  );
  return (
    <div className="mp-options" role="group" aria-label="Menu bar">
      <h3>In the menu bar</h3>
      {row('Countdown', settings.menu_bar_timer, 'menu_bar_timer')}
      {row('What is on now', settings.menu_bar_task, 'menu_bar_task')}
      <small>{settings.menu_bar_timer || settings.menu_bar_task ? 'Shown next to the Habyss mark.' : 'Only the Habyss mark.'}</small>
      <button type="button" className="mp-link" onClick={onMore}>All settings…</button>
    </div>
  );
}

/** Which planned view is showing, as the phone's page dots: Timeline, then List (swipe, or 1 and 2). */
function Pages({ value, onChange }: { value: PlanView; onChange: (v: PlanView) => void }) {
  return (
    <span className="mp-pages" role="tablist" aria-label="Planned view">
      {(['Timeline', 'List'] as PlanView[]).map(v => <button key={v} type="button" role="tab" aria-selected={value === v} aria-label={v} title={`${v} (${v === 'Timeline' ? 1 : 2})`} onClick={() => onChange(v)}><i /></button>)}
      <small>{value}</small>
    </span>
  );
}

function Column({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return <section className="mp-col" aria-label={label}><h2 className="mp-col-head">{label}{aside}</h2>{children}</section>;
}
function Hours({ axis }: { axis: Axis }) {
  return <div className="mp-hours" aria-hidden="true" style={{ height: axis.height }}>{hourMarks(axis).map(m => <span key={m} style={{ top: axis.y(m) }}>{clockLabel(m).replace(':00', '')}</span>)}</div>;
}
function SignIn() {
  return <div className="mp-signin"><p>Sign in to see your habits and tasks.</p><Button variant="quiet" onClick={() => void invoke('open_dashboard', { screen: 'Settings' })}>Open Settings</Button></div>;
}
