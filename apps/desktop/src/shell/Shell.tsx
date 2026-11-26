import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, useReducedMotion } from 'motion/react';
import type { Act, Screen, Snapshot } from '../types';
import { dayRange, duration, localDate, metrics } from '../analytics';
import { CardTitle, Metric } from '../components/ui';
import { AppUsage, CategoryChart, WeeklyChart } from '../components/charts';
import { Timeline } from '../screens/Timeline';
import { SettingsView } from '../screens/Settings';
import { TodayPanel } from '../panel/TodayPanel';
import { Dashboard } from '../dashboard/Dashboard';
import { CloudProvider, useSharedCloud } from '../today/CloudProvider';
import { AppIcon, AppLogo, Empty } from '../ui';
import { Sidebar, TABS } from './Sidebar';
import './shell.css';

const CATEGORIES = ['uncategorized', 'development', 'design', 'productivity', 'writing', 'learning', 'research', 'communication', 'meetings', 'utilities', 'browsing', 'personal', 'social', 'entertainment', 'news', 'shopping'];
const PANEL_KEY = 'habyss.panelCollapsed';
const COMING: Partial<Record<Screen, string>> = { Progress: 'Goals and roadmaps arrive here soon.', Friends: 'Friends and shared streaks arrive here soon.', Profile: 'Your profile and achievements arrive here soon.' };
/** Dashboard draws its own header. */
const SUBTITLE: Record<Exclude<Screen, 'Dashboard'>, string> = { Calendar: 'Every recorded context. Every meaningful gap.', Progress: 'Where your goals are heading.', Analytics: 'Patterns grounded in observed activity.', Friends: 'Better together.', Profile: 'Your account and achievements.', Settings: 'A quiet utility, on your terms.' };
const DATED: Screen[] = ['Calendar', 'Analytics'];
/** Names the app and the native menu emit: the retired Focus and Timeline tabs now live in Dashboard and Calendar. */
const NAV_ALIASES: Record<string, Screen> = { Focus: 'Dashboard', Timeline: 'Calendar', Applications: 'Analytics' };
const resolveScreen = (name: string): Screen | undefined => NAV_ALIASES[name] ?? TABS.find(t => t.screen === name)?.screen;

const readCollapsed = () => { try { return localStorage.getItem(PANEL_KEY) === '1'; } catch { return false; } };
const writeCollapsed = (v: boolean) => { try { localStorage.setItem(PANEL_KEY, v ? '1' : '0'); } catch { /* storage unavailable: the choice just is not remembered */ } };

interface ShellProps {
  data: Snapshot; act: Act; date: string; setDate: (d: string) => void; now: number;
  busy?: boolean; error?: string; setError?: (e: string) => void;
}

/** One cloud source for the whole window: the Dashboard and the right-column panel share it, so a tick in one shows in the other. */
export function Shell(props: ShellProps) {
  return <CloudProvider><ShellBody {...props} /></CloudProvider>;
}

function ShellBody({ data, act, date, setDate, now, busy = false, error = '', setError = () => {} }: ShellProps) {
  const [screen, setScreen] = useState<Screen>('Dashboard');
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { cloud, signedIn, statusLoading } = useSharedCloud();
  const sync = cloud.status;
  const reduced = useReducedMotion();

  useEffect(() => { let dispose: (() => void) | undefined, cancelled = false; void listen<string>('navigate', e => { const next = resolveScreen(e.payload); if (next) setScreen(next); }).then(f => { if (cancelled) f(); else dispose = f; }); return () => { cancelled = true; dispose?.(); }; }, []);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if (e.key === ',') { e.preventDefault(); setScreen('Settings'); return; }
      const tab = /^[1-7]$/.test(e.key) ? TABS[Number(e.key) - 1] : undefined;
      if (tab) { e.preventDefault(); setScreen(tab.screen); }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, []);
  // Vibrancy: the window is transparent on macOS, so the sidebar shows the system material. Elsewhere it stays solid.
  useEffect(() => { if (!isTauri() || !/Mac/.test(navigator.userAgent)) return; document.documentElement.classList.add('has-vibrancy'); return () => document.documentElement.classList.remove('has-vibrancy'); }, []);

  const [from, to] = dayRange(date);
  const weekFrom = new Date(new Date(from).setDate(new Date(from).getDate() - 6)).getTime();
  // The snapshot spans the preceding week; day screens see only the selected day.
  const day = useMemo<Snapshot>(() => ({ ...data, intervals: data.intervals.filter(i => i.end > from && i.start < to), focus: data.focus.filter(f => (f.end ?? Infinity) > from && f.start < to) }), [data, from, to]);
  const m = useMemo(() => metrics(day.intervals, day.focus, from, to, now), [day, from, to, now]);
  const weekly = useMemo(() => metrics(data.intervals, [], weekFrom, to), [data.intervals, weekFrom, to]);
  const changeDate = (delta: number) => { const d = new Date(from); d.setDate(d.getDate() + delta); setDate(localDate(d)); };
  const setPanel = (v: boolean) => { setCollapsed(v); writeCollapsed(v); };

  let body: ReactNode;
  if (screen === 'Dashboard') body = <Dashboard onNavigate={setScreen} />;
  else if (screen === 'Calendar') body = <Timeline data={day} from={from} to={to} />;
  else if (screen === 'Analytics') body = <AnalyticsContent data={data} m={m} weekly={weekly} to={to} weekFrom={weekFrom} busy={busy} act={act} />;
  else if (screen === 'Settings') body = <SettingsView data={data} busy={busy} act={act} setError={setError} />;
  else body = <Empty>{COMING[screen]}</Empty>;

  return (
    <div className="app-shell">
      <Sidebar screen={screen} onSelect={setScreen} data={data} busy={busy} act={act} sync={sync} />
      <main className="app-main">
        <div className="app-topbar" data-tauri-drag-region />
        <div className="app-content">
          {screen !== 'Dashboard' && <header className="app-header">
            <div><p className="app-eyebrow">{screen.toUpperCase()}</p><h1>{screen}</h1><p className="app-sub">{SUBTITLE[screen]}</p></div>
            {DATED.includes(screen) && <div className="app-date"><button type="button" aria-label="Previous day" onClick={() => changeDate(-1)}><AppIcon name="chevron-back" size={16} /></button><input aria-label="Selected date" type="date" value={date} onChange={e => setDate(e.target.value || localDate())} /><button type="button" aria-label="Next day" onClick={() => changeDate(1)}><AppIcon name="chevron-forward" size={16} /></button></div>}
          </header>}
          {(error || data.error) && <div role="alert" className="error">{error || data.error}</div>}
          {!data.trusted && data.settings.collect_titles && <div className="notice">App-level tracking is available. Allow Accessibility to include window titles.<button type="button" onClick={() => void act('open_permissions')}>Open Settings</button></div>}
          <motion.div key={screen} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>{body}</motion.div>
          {!statusLoading && <p className="app-privacy">{signedIn ? 'Activity stays on this Mac. Habits, goals and tasks sync with your Habyss account.' : 'Private by design. No accounts. No uploads.'}</p>}
        </div>
      </main>
      <div className="app-right"><TodayPanel mode="window" collapsed={collapsed} onCollapsedChange={setPanel} /></div>
    </div>
  );
}

type M = ReturnType<typeof metrics>;

/** Analytics tab: the former Applications table above the former Analytics charts. */
function AnalyticsContent({ data, m, weekly, to, weekFrom, busy, act }: { data: Snapshot; m: M; weekly: M; to: number; weekFrom: number; busy: boolean; act: Act }) {
  return <>
    <div className="metric-grid"><Metric title="Daily active" value={duration(m.active)} detail="Selected calendar day" /><Metric title="7-day active" value={duration(weekly.active)} detail="Six preceding days + selected day" /><Metric title="Longest active stretch" value={duration(m.longest)} detail="Across adjacent application contexts" /><Metric title="Observed during focus" value={duration(m.observedFocus)} detail="Active intervals ∩ declared sessions" /></div>
    <section className="card"><CardTitle title="A week in perspective" detail="Active computer time by local calendar day" /><WeeklyChart intervals={data.intervals} to={to} /></section>
    <div className="dashboard-columns lower"><section className="card"><CardTitle title="Application usage" detail={`${m.switches} application switches on selected day`} /><AppUsage apps={m.apps} total={m.active} /></section><section className="card"><CardTitle title="Time distribution" detail="Selected day" /><CategoryChart categories={m.categories} total={m.active} /><div className="definition"><strong>{duration(m.idle)} idle · {duration(m.active)} active</strong><p>Focus sessions express your intent. Activity records computer use; neither proves concentration or productivity.</p></div></section></div>
    <section className="card"><CardTitle title="Your applications" detail="Usage for the selected day · weekly totals include the preceding six days" />{data.applications.length === 0 ? <Empty>Your applications will appear as you use them.</Empty> : <div className="table-scroll"><table><thead><tr><th>Application</th><th>Selected day</th><th>7 days</th><th>Contexts</th><th>Category</th><th>Last used</th></tr></thead><tbody>{data.applications.map(a => { const d = m.apps.find(v => v.bundle === a.bundle_id); const w = metrics(data.intervals.filter(i => i.bundle_id === a.bundle_id), [], weekFrom, to); return <tr key={a.id}><td><div className="app-name"><AppLogo name={a.name} bundle={a.bundle_id} /><div>{a.name}<small>{a.bundle_id}</small></div></div></td><td>{duration(d?.ms ?? 0)}</td><td>{duration(w.active)}</td><td>{d?.sessions ?? 0}</td><td><select aria-label={`${a.name} category`} value={a.category} disabled={busy} onChange={e => void act('categorize', { id: a.id, category: e.target.value })}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></td><td className="muted">{new Date(a.last_seen).toLocaleDateString()}</td></tr>; })}</tbody></table></div>}</section>
  </>;
}
