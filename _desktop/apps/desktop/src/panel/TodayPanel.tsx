import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CloudData, CompletionRow, FocusSession, Snapshot } from '../types';
import { dayRange, duration, FOCUS_MINUTES, localDate, metrics } from '../analytics';
import { buildToday, type TodayItem } from '../today/today';
import { useFastClock, useSharedCloud, WithCloud } from '../today/CloudProvider';
import { localDateKey } from '../shared/habitSchedule';
import { AppIcon, Button, Card, Empty, IconButton, Segmented } from '../ui';
import { FocusControls } from './FocusControls';
import { productivePercent } from '../dashboard/stats';
import './panel.css';

type Tab = 'Today' | 'Timeline';
const clock = (min: number) => { const h = Math.floor(min / 60) % 24, m = min % 60; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const range = (i: TodayItem) => `${clock(i.start)} – ${clock(i.end)}`;
const SIGN_IN = 'Sign in to see your habits and tasks';

function SignInPrompt() {
  return <div className="tp-signin"><p>{SIGN_IN}</p><Button variant="quiet" aria-label="Open Settings" onClick={() => void invoke('open_dashboard', { screen: 'Settings' })}>Open Settings</Button></div>;
}

const tickHabit = (d: CloudData, habitId: string, date: string, on: boolean, at: string): CloudData => {
  const has = d.completions.some(c => c.habit_id === habitId && c.date === date);
  if (has) return { ...d, completions: d.completions.map(c => (c.habit_id === habitId && c.date === date ? { ...c, deleted: on ? 0 : 1, skipped: 0, value: on ? 1 : null, created_at: on && c.deleted ? at : c.created_at } : c)) };
  if (!on) return d;
  const row: CompletionRow = { id: `local-${habitId}-${date}`, user_id: null, habit_id: habitId, date, value: 1, memo: null, created_at: at, updated_at: at, evidence: null, skipped: 0, deleted: 0, synced: 0, owner_id: null, refused: 0 };
  return { ...d, completions: [...d.completions, row] };
};

type PanelProps = { mode: 'menubar' | 'window'; collapsed?: boolean; onCollapsedChange?: (collapsed: boolean) => void };

/** In the Shell it shares the Dashboard's cloud data and clock; the menu bar panel window starts its own. */
export function TodayPanel(props: PanelProps) {
  return <WithCloud><Panel {...props} /></WithCloud>;
}

function Panel({ mode, collapsed: controlled, onCollapsedChange }: PanelProps) {
  const { cloud, signedIn, statusLoading, now, minute } = useSharedCloud();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>('Today');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [inner, setInner] = useState(false);
  const collapsed = controlled ?? inner;
  const setCollapsed = (next: boolean) => { setInner(next); onCollapsedChange?.(next); };

  const errorOwner = useRef('');
  const day = localDate(new Date(minute));
  const loadSnap = useCallback(async () => {
    if (!isTauri()) return;
    const [from, to] = dayRange(localDate());
    try { setSnap(await invoke<Snapshot>('snapshot', { from, to })); if (errorOwner.current === 'snapshot') { errorOwner.current = ''; setError(''); } } catch (e) { errorOwner.current = 'snapshot'; setError(String(e)); }
  }, []);
  useEffect(() => {
    void loadSnap();
    let dispose: (() => void) | undefined, cancelled = false;
    void listen('activity-updated', () => void loadSnap()).then(f => { if (cancelled) f(); else dispose = f; });
    return () => { cancelled = true; dispose?.(); };
  }, [loadSnap]);
  const running: FocusSession | null = snap?.focus.find(f => f.end === null) ?? null;
  useFastClock(running !== null);

  const waiting = statusLoading || cloud.loading;
  // Day figures use the shared minute, as the Dashboard does, so both show the same numbers.
  const today = useMemo(() => buildToday(cloud.data, { now: new Date(minute), signedIn }), [cloud.data, minute, signedIn]);
  const upNext = today.current ?? today.next;

  const m = useMemo(() => { const [from, to] = dayRange(day); return metrics(snap?.intervals ?? [], snap?.focus ?? [], from, to, minute); }, [snap, day, minute]);
  const share = useMemo(() => { const [from, to] = dayRange(day); return productivePercent(snap?.intervals ?? [], snap?.classifications ?? {}, from, to, minute); }, [snap, day, minute]);
  const productive = share === null ? '–' : `${share}%`;

  /** Returns whether the command succeeded. Only the action that set the error clears it. */
  const run = async (cmd: string, args?: Record<string, unknown>, revert = false): Promise<boolean> => {
    try { await invoke(cmd, args); if (errorOwner.current === cmd) { errorOwner.current = ''; setError(''); } return true; }
    catch (e) { errorOwner.current = cmd; setError(String(e)); if (revert) await cloud.refresh(); return false; }
  };
  const focusCmd = async (cmd: string, args?: Record<string, unknown>) => { await run(cmd, args); await loadSnap(); };
  const startFocus = (item: TodayItem | null) => focusCmd('start_focus', { label: item?.title ?? 'Focus', minutes: FOCUS_MINUTES, itemId: item?.id ?? null, itemKind: item?.kind ?? null });
  const toggle = (item: TodayItem) => {
    // The date is read at the click: the shared clock can lag up to 30 s behind midnight.
    const clicked = new Date(), on = !item.done, at = clicked.toISOString(), date = localDateKey(clicked);
    if (item.kind === 'habit') {
      cloud.setLocal(d => tickHabit(d, item.id, date, on, at));
      void run('cloud_set_completion', { habitId: item.id, date, value: on ? 1 : null, skipped: false, memo: null, evidence: null }, true);
    } else {
      cloud.setLocal(d => ({ ...d, tasks: d.tasks.map(t => (t.id === item.id ? { ...t, status: on ? 'done' : 'open', completed_at: on ? at : null } : t)) }));
      void run('cloud_set_task_done', { id: item.id, done: on }, true);
    }
  };
  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    if (!(await run('cloud_save', { table: 'tasks', row: { title, due_date: localDateKey(new Date()), status: 'open' } }))) return;
    setDraft(''); setAdding(false);
    await cloud.refresh();
  };

  if (collapsed) return <aside className={`tp tp-${mode} tp-collapsed`}><IconButton icon="chevron-back" label="Expand panel" onClick={() => setCollapsed(false)} /></aside>;

  const rows = today.items;
  const planner = waiting ? <Empty>Loading…</Empty> : !signedIn ? <SignInPrompt /> : null;
  return (
    <aside className={`tp tp-${mode}`}>
      <header className="tp-head">
        <AppIcon name="hourglass" size={22} />
        <h1 className="tp-title">Focus Mode</h1>
        <FocusControls variant="compact" session={running} now={now} label={upNext?.title} onStart={() => void startFocus(upNext)} onStop={() => void focusCmd('stop_focus')} onPause={() => void focusCmd('pause_focus')} onResume={() => void focusCmd('resume_focus')} />
        {mode === 'window' && <IconButton icon="chevron-forward" label="Collapse panel" onClick={() => setCollapsed(true)} />}
      </header>
      <Segmented options={['Today', 'Timeline'] as Tab[]} value={tab} onChange={setTab} />
      {error && <p role="alert" className="tp-error">{error}</p>}
      {cloud.error && signedIn && <p role="alert" className="tp-error">{cloud.error}</p>}

      {planner ?? (tab === 'Today' ? (
        <section className="tp-section">
          <div className="tp-section-head"><h2>Due Today <span>· {today.listedDone}/{today.listedTotal}</span></h2><IconButton icon="add" label="Add task" onClick={() => setAdding(a => !a)} /></div>
          {adding && <form className="tp-add" onSubmit={e => void addTask(e)}><input autoFocus aria-label="New task" placeholder="New task" value={draft} onChange={e => setDraft(e.target.value)} /></form>}
          {rows.length === 0 ? <Empty>Nothing due today.</Empty> : <ul className="tp-list">{rows.map(i => (
            <li key={`${i.kind}:${i.id}:${i.start}`} className={`tp-row${i.done ? ' done' : ''}`}>
              <button type="button" className="tp-check" aria-label={i.done ? `Mark ${i.title} not done` : `Mark ${i.title} done`} onClick={() => toggle(i)}><AppIcon name={i.done ? 'checkmark-circle' : 'ellipse'} size={22} filled={i.done} /></button>
              <span className="tp-row-title">{i.title}</span>
            </li>))}</ul>}
        </section>
      ) : (
        <section className="tp-section">
          {rows.length === 0 ? <Empty>Nothing scheduled today.</Empty> : <ul className="tp-list">{rows.map(i => (
            <li key={`${i.kind}:${i.id}:${i.start}`} className={`tp-row tp-time${i.state === 'now' ? ' now' : ''}${i.done ? ' done' : ''}`}>
              <span className="tp-when">{range(i)}</span><span className="tp-row-title">{i.title}</span>{i.state === 'now' && <span className="tp-now">Now</span>}
            </li>))}</ul>}
        </section>
      ))}

      <section className="tp-section">
        <h2>Up Next</h2>
        {planner ?? (upNext ? (
          <div className="tp-next"><IconButton icon="play" label={`Start focus on ${upNext.title}`} filled onClick={() => void startFocus(upNext)} /><div><strong>{upNext.title}</strong><small>Today · {range(upNext)}</small></div></div>
        ) : <Empty>Nothing left today.</Empty>)}
      </section>

      <Card title="Today at a Glance" className="tp-glance">
        <Stat icon="hourglass" label="Focus Time" value={duration(m.declared)} />
        <Stat icon="desktop" label="Screen Time" value={duration(m.active)} />
        <Stat icon="trending-up" label="Productive" value={productive} />
        <Stat icon="checkmark-circle" label="Tasks" value={signedIn ? `${today.tasksDone}/${today.tasksTotal}` : '–'} />
      </Card>
    </aside>
  );
}

function Stat({ icon, label, value }: { icon: 'hourglass' | 'desktop' | 'trending-up' | 'checkmark-circle'; label: string; value: string }) {
  return <div className="tp-stat"><AppIcon name={icon} size={20} /><strong>{value}</strong><small>{label}</small></div>;
}
