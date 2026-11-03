import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CloudData, CompletionRow, FocusSession, Snapshot } from '../types';
import { dayRange, duration, localDate, metrics } from '../analytics';
import { buildToday, type TodayItem } from '../today/today';
import { useCloud } from '../today/useCloud';
import { AppIcon, Button, Card, Empty, IconButton, Segmented } from '../ui';
import { FocusControls } from './FocusControls';
import './panel.css';

type Tab = 'Today' | 'Timeline';
const FOCUS_MINUTES = 25;
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

export function TodayPanel({ mode }: { mode: 'menubar' | 'window' }) {
  const cloud = useCloud();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<Tab>('Today');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const day = localDate(new Date(now));
  const loadSnap = useCallback(async () => {
    if (!isTauri()) return;
    const [from, to] = dayRange(localDate());
    try { setSnap(await invoke<Snapshot>('snapshot', { from, to })); } catch (e) { setError(String(e)); }
  }, []);
  useEffect(() => {
    void loadSnap();
    let dispose: (() => void) | undefined, cancelled = false;
    void listen('activity-updated', () => void loadSnap()).then(f => { if (cancelled) f(); else dispose = f; });
    return () => { cancelled = true; dispose?.(); };
  }, [loadSnap]);
  const running: FocusSession | null = snap?.focus.find(f => f.end === null) ?? null;
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), running ? 1000 : 30000); return () => clearInterval(t); }, [running]);

  const state = cloud.status?.state;
  const signedIn = !!state && state !== 'signed_out' && state !== 'unconfigured';
  const waiting = cloud.loading || (cloud.status === null && !cloud.error);
  const today = useMemo(() => buildToday(cloud.data, { now: new Date(now), signedIn }), [cloud.data, now, signedIn]);
  const upNext = today.current ?? today.next;

  const m = useMemo(() => { const [from, to] = dayRange(day); return metrics(snap?.intervals ?? [], snap?.focus ?? [], from, to, now); }, [snap, day, now]);
  const productiveMs = m.categories.reduce((n, [c, ms]) => n + (snap?.classifications[c] === 'productive' ? ms : 0), 0);
  const classifiedMs = m.categories.reduce((n, [c, ms]) => n + (snap?.classifications[c] ? ms : 0), 0);
  const productive = classifiedMs > 0 && m.active > 0 ? `${Math.round(productiveMs / m.active * 100)}%` : '–';

  const run = async (cmd: string, args?: Record<string, unknown>) => { setError(''); try { await invoke(cmd, args); } catch (e) { setError(String(e)); await cloud.refresh(); } };
  const focusCmd = async (cmd: string, args?: Record<string, unknown>) => { await run(cmd, args); await loadSnap(); };
  const startFocus = (item: TodayItem | null) => focusCmd('start_focus', { label: item?.title ?? 'Focus', minutes: FOCUS_MINUTES, itemId: item?.id ?? null, itemKind: item?.kind ?? null });
  const toggle = (item: TodayItem) => {
    const on = !item.done, at = new Date().toISOString();
    if (item.kind === 'habit') {
      cloud.setLocal(d => tickHabit(d, item.id, today.day, on, at));
      void run('cloud_set_completion', { habitId: item.id, date: today.day, value: on ? 1 : null, skipped: false, memo: null, evidence: null });
    } else {
      cloud.setLocal(d => ({ ...d, tasks: d.tasks.map(t => (t.id === item.id ? { ...t, status: on ? 'done' : 'open', completed_at: on ? at : null } : t)) }));
      void run('cloud_set_task_done', { id: item.id, done: on });
    }
  };
  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setDraft(''); setAdding(false);
    await run('cloud_save', { table: 'tasks', row: { title, due_date: today.day, status: 'open' } });
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
        <FocusControls variant="compact" session={running} now={now} label={upNext?.title} onStart={() => void startFocus(today.current)} onStop={() => void focusCmd('stop_focus')} onPause={() => void focusCmd('pause_focus')} onResume={() => void focusCmd('resume_focus')} />
        {mode === 'window' && <IconButton icon="chevron-forward" label="Collapse panel" onClick={() => setCollapsed(true)} />}
      </header>
      <Segmented options={['Today', 'Timeline'] as Tab[]} value={tab} onChange={setTab} />
      {error && <p role="alert" className="tp-error">{error}</p>}
      {cloud.error && signedIn && <p role="alert" className="tp-error">{cloud.error}</p>}

      {planner ?? (tab === 'Today' ? (
        <section className="tp-section">
          <div className="tp-section-head"><h2>Due Today <span>· {today.done}/{today.total}</span></h2><IconButton icon="add" label="Add task" onClick={() => setAdding(a => !a)} /></div>
          {adding && <form className="tp-add" onSubmit={e => void addTask(e)}><input autoFocus aria-label="New task" placeholder="New task" value={draft} onChange={e => setDraft(e.target.value)} /></form>}
          {rows.length === 0 ? <Empty>Nothing due today.</Empty> : <ul className="tp-list">{rows.map(i => (
            <li key={i.id} className={`tp-row${i.done ? ' done' : ''}`}>
              <button type="button" className="tp-check" aria-label={i.done ? `Mark ${i.title} not done` : `Mark ${i.title} done`} onClick={() => toggle(i)}><AppIcon name={i.done ? 'checkmark-circle' : 'ellipse'} size={22} filled={i.done} /></button>
              <span className="tp-row-title">{i.title}</span>
            </li>))}</ul>}
        </section>
      ) : (
        <section className="tp-section">
          {rows.length === 0 ? <Empty>Nothing scheduled today.</Empty> : <ul className="tp-list">{rows.map(i => (
            <li key={i.id} className={`tp-row tp-time${i.state === 'now' ? ' now' : ''}${i.done ? ' done' : ''}`}>
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
        <Stat icon="checkmark-circle" label="Tasks" value={signedIn ? `${today.done}/${today.total}` : '–'} />
      </Card>
    </aside>
  );
}

function Stat({ icon, label, value }: { icon: 'hourglass' | 'desktop' | 'trending-up' | 'checkmark-circle'; label: string; value: string }) {
  return <div className="tp-stat"><AppIcon name={icon} size={20} /><strong>{value}</strong><small>{label}</small></div>;
}
