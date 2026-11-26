import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Cached, FocusSession, Screen, Snapshot } from '../types';
import { dayRange, duration, FOCUS_MINUTES, localDate, metrics } from '../analytics';
import { buildToday, type TodayItem } from '../today/today';
import { useFastClock, useSharedCloud, WithCloud } from '../today/CloudProvider';
import { localDateKey } from '../shared/habitSchedule';
import { FocusControls } from '../panel/FocusControls';
import { AbyssArt, AppIcon, Button, Card, Donut, Empty, Segmented, StatTile, type IconName } from '../ui';
import { UsageList } from '../tracking/UsageList';
import { allocation, greeting, productivePercent, rangeBounds, tasksInRange, type Range } from './stats';
import '../panel/panel.css';
import './dashboard.css';

type View = 'Scheduled' | 'Activity';
type Loaded = { snap: Snapshot; range: Range; from: number };
const RANGES: Range[] = ['Today', 'Week', 'Month', 'Year'];
const VIEWS: View[] = ['Scheduled', 'Activity'];
type LiveView = 'Apps' | 'Websites';
const LIVE_VIEWS: LiveView[] = ['Apps', 'Websites'];
const MIN = 60000;
/** Wider ranges re-query on activity at most once a minute; Today stays live. */
const WIDE_REFRESH_MS = MIN;
const itemKey = (id: string | null | undefined, kind: string | null | undefined) => `${kind ?? ''}:${id ?? ''}`;
const DASH = '–';
/** Phone item icons that AppIcon can draw; anything else falls back to the item's kind. */
const KNOWN_ICONS: IconName[] = ['cube', 'heart', 'wallet', 'moon', 'flame', 'sparkles', 'timer', 'desktop', 'calendar', 'people', 'person', 'home', 'trending-up', 'stats-chart', 'hourglass'];

const clock = (minute: number) => { const h = Math.floor(minute / 60) % 24, m = minute % 60; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const iconFor = (icon: string | undefined, fallback: IconName): IconName => { const name = icon?.replace(/-outline$/, '') as IconName | undefined; return name && KNOWN_ICONS.includes(name) ? name : fallback; };
/** Slice colours: shades of the accent, with Other in the neutral tone. Shared by the donut and its legend. */
const sliceColor = (i: number, label: string) => (label === 'Other' ? 'var(--text-subtle)' : `color-mix(in srgb, var(--accent) ${Math.max(30, 100 - i * 18)}%, var(--surface-raised))`);

/** The profiles row arrives as one object or a one-row array. The display name wins; the username stands in. */
export function profileName(value: unknown): string {
  const row = (Array.isArray(value) ? value[0] : value) as { display_name?: unknown; username?: unknown } | null | undefined;
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return text(row?.display_name) || text(row?.username);
}

function SignIn({ text, onNavigate }: { text: string; onNavigate?: (s: Screen) => void }) {
  return <div className="db-signin"><p>{text}</p>{onNavigate && <Button variant="quiet" onClick={() => onNavigate('Profile')}>Sign in</Button>}</div>;
}

type DashboardProps = { onNavigate?: (s: Screen) => void };

/** In the Shell it shares the panel's cloud data and clock; on its own it starts them. */
export function Dashboard(props: DashboardProps) {
  return <WithCloud><DashboardBody {...props} /></WithCloud>;
}

function DashboardBody({ onNavigate }: DashboardProps) {
  const { cloud, signedIn, statusLoading, now, minute } = useSharedCloud();
  const [range, setRange] = useState<Range>('Today');
  const [view, setView] = useState<View>('Scheduled');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [name, setName] = useState('');
  const [pickKey, setPickKey] = useState<string | null>(null);
  const [snapError, setSnapError] = useState('');
  const [error, setError] = useState('');

  const waiting = statusLoading || cloud.loading;
  const day = localDate(new Date(minute));

  // The range has its own query; the shell's 7-day snapshot stays as it is. Only the latest request lands.
  const seq = useRef(0);
  const lastLoad = useRef(0);
  const loadSnap = useCallback(async () => {
    if (!isTauri()) return;
    const id = ++seq.current;
    lastLoad.current = Date.now();
    const [from, to] = rangeBounds(range, new Date());
    try {
      const snap = await invoke<Snapshot>('snapshot', { from, to });
      if (id === seq.current) { setLoaded({ snap, range, from }); setSnapError(''); }
    } catch (e) { if (id === seq.current) setSnapError(String(e)); }
  }, [range, day]); // day: a new local day moves the range start, so it requeries.
  useEffect(() => {
    void loadSnap();
    let dispose: (() => void) | undefined, cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
    const onActivity = () => {
      if (range === 'Today') { void loadSnap(); return; }
      if (timer) return;
      const wait = lastLoad.current + WIDE_REFRESH_MS - Date.now();
      if (wait <= 0) void loadSnap(); else timer = setTimeout(() => { timer = undefined; void loadSnap(); }, wait);
    };
    void listen('activity-updated', onActivity).then(f => { if (cancelled) f(); else dispose = f; });
    return () => { cancelled = true; dispose?.(); clearTimeout(timer); };
  }, [loadSnap, range]);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    invoke<Cached<unknown>>('cloud_rpc', { name: 'profile', args: {} }).then(r => { if (alive) setName(profileName(r?.value)); }, () => { if (alive) setName(''); });
    return () => { alive = false; };
  }, [signedIn]);
  const shownName = signedIn ? name : '';

  const [liveView, setLiveView] = useState<LiveView>('Apps');
  const snap = loaded?.snap ?? null;
  const running: FocusSession | null = snap?.focus.find(f => f.end === null) ?? null;
  useFastClock(running !== null);

  // Day and range figures move by the shared minute; only the focus clock needs the second.
  const today = useMemo(() => buildToday(cloud.data, { now: new Date(minute), signedIn }), [cloud.data, minute, signedIn]);
  const from = loaded?.from ?? rangeBounds(range, new Date(minute))[0];
  const intervals = useMemo(() => snap?.intervals ?? [], [snap]);
  const classes = useMemo(() => snap?.classifications ?? {}, [snap]);
  const m = useMemo(() => metrics(intervals, snap?.focus ?? [], from, minute, minute), [intervals, snap, from, minute]);
  const slices = useMemo(() => allocation(intervals, from, minute, minute), [intervals, from, minute]);
  const productive = useMemo(() => productivePercent(intervals, classes, from, minute, minute), [intervals, classes, from, minute]);
  // Ruling P6: for Today, the listed tasks of the today model, as the panel shows; wider ranges count tasks due in the range.
  const rangeTasks = useMemo(() => tasksInRange(cloud.data?.tasks ?? [], localDateKey(new Date(from)), localDateKey(new Date(minute))), [cloud.data, from, minute]);
  const tasks = range === 'Today' ? { done: today.tasksDone, total: today.tasksTotal } : rangeTasks;
  const tracked = slices.reduce((n, s) => n + s.value, 0);
  // Plan figures need an account and its data; anything less shows a dash, never a zero.
  const ready = signedIn && cloud.data !== null;
  const planned = (value: string) => (ready ? value : DASH);

  /** Only the action that set the error clears it. */
  const errorOwner = useRef('');
  const run = async (cmd: string, args?: Record<string, unknown>): Promise<boolean> => {
    try { await invoke(cmd, args); if (errorOwner.current === cmd) { errorOwner.current = ''; setError(''); } return true; }
    catch (e) { errorOwner.current = cmd; setError(String(e)); return false; }
  };
  const open = today.items.filter(i => !i.done);
  const picked = open.find(i => itemKey(i.id, i.kind) === pickKey) ?? open.find(i => i === today.current || i === today.next) ?? open[0] ?? null;
  const linked = running?.item_id ? today.items.find(i => itemKey(i.id, i.kind) === itemKey(running.item_id, running.item_kind)) ?? null : null;
  /** The item the card is on: the running session's, or the one picked for the next start. */
  const focusKey = running ? itemKey(running.item_id, running.item_kind) : picked && itemKey(picked.id, picked.kind);
  const start = async (item: TodayItem | null) => { await run('start_focus', { label: item?.title ?? 'Focus', minutes: FOCUS_MINUTES, itemId: item?.id ?? null, itemKind: item?.kind ?? null }); await loadSnap(); };
  const focusCmd = async (cmd: string) => { await run(cmd); await loadSnap(); };
  /** Idle: picks the neighbouring open item for play. Running: switches the timer to it, a fresh countdown on that item. */
  const step = async (delta: number) => {
    const at = open.findIndex(i => itemKey(i.id, i.kind) === focusKey);
    const target = open[at < 0 ? (delta > 0 ? 0 : open.length - 1) : (at + delta + open.length) % open.length];
    if (!target || itemKey(target.id, target.kind) === focusKey) return;
    setPickKey(itemKey(target.id, target.kind));
    if (!running) return;
    if (await run('stop_focus')) await start(target); else await loadSnap();
  };
  /** Ends the session and marks its linked item done. */
  const finish = async () => {
    if (!(await run('stop_focus')) || !linked || linked.done) { await loadSnap(); return; }
    const ok = linked.kind === 'task'
      ? await run('cloud_set_task_done', { id: linked.id, done: true })
      : await run('cloud_set_completion', { habitId: linked.id, date: localDateKey(new Date()), value: 1, skipped: false, memo: null, evidence: null });
    await Promise.all([loadSnap(), ok ? cloud.refresh() : Promise.resolve()]);
  };
  const canStep = ready && open.some(i => itemKey(i.id, i.kind) !== focusKey);

  const planner = waiting ? <Empty>Loading…</Empty> : signedIn && !ready ? <Empty>Your plan could not be loaded.</Empty> : null;
  return (
    <div className="db">
      <header className="db-hero">
        <div className="db-hero-art"><AbyssArt size="hero" /></div>
        <p className="db-eyebrow">DASHBOARD</p>
        <h1 className="db-title">{`${greeting(new Date(minute))}${shownName ? `, ${shownName}` : ''}.`}</h1>
        <p className="db-sub">Discipline compounds. So does freedom.</p>
        <div className="db-range"><Segmented options={RANGES} value={range} onChange={setRange} /></div>
      </header>

      {snapError && <p role="alert" className="db-error">{snapError}</p>}
      {cloud.error && signedIn && <p role="alert" className="db-error">{cloud.error}</p>}

      <div className="db-stats">
        <StatTile icon="flame" value={planned(String(today.streak))} label="Day Streak" />
        <StatTile icon="hourglass" value={duration(m.declared)} label="Focus Time" />
        <StatTile icon="checkmark-circle" value={planned(`${tasks.done}/${tasks.total}`)} label="Tasks" />
        <StatTile icon="stats-chart" value={productive === null ? DASH : `${productive}%`} label="Productive" />
      </div>

      <div className="db-row db-row-mid">
        <Card className="db-focus" title={<><AppIcon name="timer" size={18} />Focus</>}>
          {error && <p role="alert" className="db-error">{error}</p>}
          <FocusControls variant="full" session={running} now={now} label={picked?.title}
            onStart={() => void start(picked)} onStop={() => void focusCmd('stop_focus')} onPause={() => void focusCmd('pause_focus')} onResume={() => void focusCmd('resume_focus')}
            onPrevious={canStep ? () => void step(-1) : undefined} onNext={canStep ? () => void step(1) : undefined}
            onFinish={ready && linked && !linked.done ? () => void finish() : undefined} />
        </Card>

        <Card className="db-alloc" title="Time Allocation" aside={`(${loaded?.range ?? range})`}>
          {slices.length === 0 ? <Empty>No tracked time yet.</Empty> : (
            <div className="db-alloc-body">
              <Donut slices={slices.map((s, i) => ({ ...s, color: sliceColor(i, s.label) }))} center={duration(tracked)} caption="Total Tracked" />
              <ul className="db-legend">{slices.map((s, i) => (
                <li key={s.label}><i style={{ background: sliceColor(i, s.label) }} /><span className="db-legend-label">{s.label}</span><span className="db-legend-value">{Math.round(s.value / tracked * 100)}%</span></li>
              ))}</ul>
            </div>
          )}
        </Card>

      </div>

      <div className="db-row db-row-low">
        <Card className="db-timeline" title="Today's Timeline" action={<Segmented options={VIEWS} value={view} onChange={setView} />}>
          {view === 'Scheduled'
            ? planner ?? (!signedIn ? <SignIn text="Sign in to see your habits and tasks." onNavigate={onNavigate} />
              : today.items.length === 0 ? <Empty>Nothing scheduled today.</Empty>
              : <ol className="db-tl">{today.items.map(i => <ScheduledRow key={`${i.kind}:${i.id}:${i.start}`} item={i} />)}</ol>)
            : <UsageList intervals={intervals} from={dayRange(day)[0]} to={dayRange(day)[1]} classes={classes} empty="No activity recorded today." />}
        </Card>

        <Card className="db-live" title={<><span className={`db-live-dot${snap?.settings.tracking_enabled ? ' on' : ''}`} aria-hidden="true" />Activity</>} aside="(Live)" action={<Segmented options={LIVE_VIEWS} value={liveView} onChange={setLiveView} />}>
          <UsageList key={liveView} intervals={intervals} from={from} to={minute} by={liveView === 'Apps' ? 'app' : 'site'} classes={classes} limit={6} compact
            empty={liveView === 'Apps' ? 'No app activity yet.' : snap?.settings.collect_titles ? 'No websites yet. Allow Habyss to read your browser when macOS asks.' : 'Turn on window titles in Settings to see websites.'} />
          {m.active > 0 && <p className="db-input">Typing {duration(m.input.typing)} · Mouse {duration(m.input.pointer)}{m.input.meeting >= 60000 ? ` · Calls ${duration(m.input.meeting)}` : ''}{m.input.media >= 60000 ? ` · Video ${duration(m.input.media)}` : ''}</p>}
        </Card>
      </div>
    </div>
  );
}

function ScheduledRow({ item: i }: { item: TodayItem }) {
  const now = i.state === 'now';
  const icon: IconName = i.done ? 'checkmark-circle' : now ? 'play' : iconFor(i.icon, i.kind === 'task' ? 'checkmark-circle' : 'ellipse');
  return (
    <li className={`db-tl-row${now ? ' now' : ''}${i.done ? ' done' : ''}`}>
      <span className="db-tl-time">{clock(i.start)}</span>
      <span className="db-tl-rail" aria-hidden="true">{now && <i />}</span>
      <div className="db-tl-item">
        <span className="db-tl-icon"><AppIcon name={icon} size={18} filled={i.done || now} label={i.done ? 'Done' : undefined} /></span>
        <span className="db-tl-title">{i.title}</span>
        {now ? <span className="db-tl-now">Now</span> : <span className="db-tl-len">{duration((i.end - i.start) * MIN)}</span>}
      </div>
    </li>
  );
}

