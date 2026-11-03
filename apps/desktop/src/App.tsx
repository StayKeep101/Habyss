import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Activity, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Clock3, Command, Flag, LayoutDashboard, LockKeyhole, Pause, Play, Settings2, ShieldCheck, Timer, Layers } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { Screen, Snapshot, SyncStatus } from './types';
import { dayRange, duration, localDate, metrics } from './analytics';
import { ActivityRows, AppBadge, CardTitle, Empty, Metric } from './components/ui';
import { ActivityChart, AppUsage, CategoryChart, WeeklyChart } from './components/charts';
import { Timeline } from './screens/Timeline';
import { Focus } from './screens/Focus';
import { SettingsView } from './screens/Settings';
import { Onboarding } from './screens/Onboarding';
import { TodayPanel } from './panel/TodayPanel';
import { applyTheme, themeForAppearance } from './theme/css';
const sections: Screen[] = ['Dashboard', 'Timeline', 'Applications', 'Focus', 'Analytics', 'Settings'];
const icons = [LayoutDashboard, Activity, Layers, Timer, BarChart3, Settings2];
const categories = ['uncategorized', 'development', 'communication', 'research', 'design', 'personal'];
const panel = new URLSearchParams(location.search).has('panel');
export default function App() {
    const [screen, setScreen] = useState<Screen>('Dashboard');
    const [date, setDate] = useState(localDate());
    const [data, setData] = useState<Snapshot | null>(null);
    const [sync, setSync] = useState<SyncStatus | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(Date.now());
    const reduced = useReducedMotion();
    const lastToday = useRef(localDate());
    useEffect(() => { const today = localDate(new Date(now)); if (today !== lastToday.current) {
        if (date === lastToday.current)
            setDate(today);
        lastToday.current = today;
    } }, [now, date]);
    const [from, to] = dayRange(date);
    const queryFrom = screen === 'Analytics' || screen === 'Applications' ? new Date(new Date(from).setDate(new Date(from).getDate() - 6)).getTime() : from;
    const refresh = useCallback(async () => { if (!isTauri())
        return; try {
        setData(await invoke<Snapshot>('snapshot', { from: queryFrom, to }));
    }
    catch (e) {
        setError(String(e));
    } }, [queryFrom, to]);
    useEffect(() => { void refresh(); let dispose: (() => void) | undefined; let cancelled = false; void listen('activity-updated', () => void refresh()).then(f => { if (cancelled)
        f();
    else
        dispose = f; }); let timer: ReturnType<typeof setInterval> | undefined; const onVisible = () => { if (timer)
        clearInterval(timer); if (!document.hidden) {
        setNow(Date.now());
        void refresh();
        timer = setInterval(() => setNow(Date.now()), 1000);
    } }; onVisible(); document.addEventListener('visibilitychange', onVisible); return () => { cancelled = true; dispose?.(); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); }; }, [refresh]);
    useEffect(() => { if (!isTauri()) return; let dispose: (() => void) | undefined; let cancelled = false; void invoke<SyncStatus>('cloud_status').then(s => { if (!cancelled) setSync(s); }).catch(() => { }); void listen<SyncStatus>('sync-status', e => setSync(e.payload)).then(f => { if (cancelled)
        f();
    else
        dispose = f; }); return () => { cancelled = true; dispose?.(); }; }, []);
    useEffect(() => { let dispose: (() => void) | undefined; let cancelled = false; void listen<string>('navigate', e => { if (sections.includes(e.payload as Screen))
        setScreen(e.payload as Screen); }).then(f => { if (cancelled)
        f();
    else
        dispose = f; }); return () => { cancelled = true; dispose?.(); }; }, []);
    useEffect(() => { const mode = data?.settings.appearance ?? 'dark'; const apply = () => applyTheme(themeForAppearance(mode)); apply(); if (mode !== 'system') return; const mq = matchMedia('(prefers-color-scheme: light)'); mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply); }, [data?.settings.appearance]);
    useEffect(() => { function keys(e: KeyboardEvent) { if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setScreen('Settings');
    } } window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys); }, []);
    const act = async (command: string, args: Record<string, unknown> = {}) => { setBusy(true); setError(''); try {
        await invoke(command, args);
        await refresh();
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } };
    const m = useMemo(() => metrics(data?.intervals ?? [], data?.focus ?? [], from, to, now), [data, from, to, now]);
    const tracking = Boolean(data?.settings.tracking_enabled);
    const signedIn = Boolean(sync && !['unconfigured', 'signed_out'].includes(sync.state));
    const changeDate = (delta: number) => { const d = new Date(from); d.setDate(d.getDate() + delta); setDate(localDate(d)); };
    if (panel)
        return <TodayPanel mode="menubar"/>;
    if (!isTauri())
        return <div className="connection"><img src="/logo.png" alt=""/><h1>Habyss Desktop</h1><p>Open the native macOS app to view your activity.</p><p>This browser preview has no access to the tracking engine. No sample activity is displayed.</p><code>bun run dev</code></div>;
    if (!data)
        return <div className="connection"><img src="/logo.png" alt=""/><h1>Opening your day</h1><p>{error || 'Connecting to the local tracking engine…'}</p>{error && <button onClick={() => void refresh()}>Try again</button>}</div>;
    const status = <span className={`status ${tracking ? 'on' : ''}`}><i />{data.error ? 'Tracking error' : tracking ? data.state.replaceAll('_', ' ') : 'Paused'}</span>;
    if (!data.settings.onboarding_complete)
        return <Onboarding data={data} busy={busy} error={error} act={act}/>;
    return <div className="shell"><aside className="sidebar"><div data-tauri-drag-region className="drag-space"/><div className="brand"><img src="/logo.png" alt=""/>Habyss<span>DESKTOP</span></div><p className="nav-caption">YOUR WORKSPACE</p><nav>{sections.map((item, i) => { const Icon = icons[i]; return <button key={item} className={screen === item ? 'selected' : ''} onClick={() => setScreen(item)}><Icon size={19}/>{item}{screen === item && <span className="nav-dot"/>}</button>; })}</nav><div className="sidebar-bottom"><div className="local-note"><ShieldCheck size={18}/><div>Yours. Only yours.<small>Stored locally on this Mac</small></div></div><div className="track-row"><button className="tracking-control" disabled={busy} onClick={() => void act('set_tracking', { enabled: !tracking })}>{tracking ? <Pause size={15}/> : <Play size={15}/>} {tracking ? 'Pause tracking' : 'Resume tracking'}{status}</button>{sync && sync.state !== 'unconfigured' && <span className={`status sync-dot ${sync.state === 'idle' || sync.state === 'syncing' ? 'on' : sync.state === 'offline' ? 'warn' : sync.state === 'error' ? 'bad' : ''}`} role="img" aria-label={`Sync: ${sync.state.replaceAll('_', ' ')}`} title={`Sync: ${sync.state.replaceAll('_', ' ')}`}><i/></span>}</div><small className="version">Habyss {data.version} <Command size={11}/> , for settings</small></div></aside><main><div className="topbar" data-tauri-drag-region><span>Workspace <span className="slash">/</span> {screen}</span><div>{status}<span className="local-pill"><LockKeyhole size={12}/> Local</span></div></div><div className="content"><header className="page-header"><div><p className="eyebrow">{screen === 'Dashboard' ? 'A LITTLE CLARITY, EVERY DAY' : 'YOUR TIME, UNDERSTOOD'}</p><h1>{screen === 'Dashboard' ? 'Your day, in focus.' : screen}</h1><p className="subtitle">{screen === 'Dashboard' ? 'An honest picture of where your time goes.' : screen === 'Timeline' ? 'Every recorded context. Every meaningful gap.' : screen === 'Applications' ? 'The tools that shape your day.' : screen === 'Focus' ? 'Create a little space for what matters.' : screen === 'Analytics' ? 'Patterns grounded in observed activity.' : 'A quiet utility, on your terms.'}</p></div>{!['Settings', 'Focus'].includes(screen) && <div className="date-picker"><button aria-label="Previous day" onClick={() => changeDate(-1)}><ChevronLeft size={16}/></button><input aria-label="Selected date" type="date" value={date} onChange={e => setDate(e.target.value || localDate())}/><button aria-label="Next day" onClick={() => changeDate(1)}><ChevronRight size={16}/></button></div>}</header>{(error || data.error) && <div role="alert" className="error">{error || data.error}</div>}{!data.trusted && data.settings.collect_titles && <div className="notice"><ShieldCheck size={17}/>App-level tracking is available. Allow Accessibility to include window titles.<button onClick={() => void act('open_permissions')}>Open Settings <ArrowUpRight size={14}/></button></div>}
 <motion.div key={screen} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .16 }}>
 {screen === 'Dashboard' && <><div className="metric-grid"><Metric title="Active time" value={duration(m.active)} detail="Observed computer activity" icon={<Activity size={17}/>}/><Metric title="Declared focus" value={duration(m.declared)} detail={`${duration(m.observedFocus)} overlapped active use`} icon={<Flag size={17}/>}/><Metric title="Idle time" value={duration(m.idle)} detail={`After ${data.settings.idle_threshold}s without input`} icon={<Clock3 size={17}/>}/><Metric title="App switches" value={String(m.switches)} detail="Between adjacent active contexts" icon={<Layers size={17}/>}/></div><div className="dashboard-columns"><section className="card activity-card"><CardTitle title="The rhythm of your day" detail="Active minutes per hour"/><ActivityChart intervals={data.intervals} from={from} to={to}/><div className="chart-legend"><i />Active computer time<span>Unobserved time stays empty</span></div></section><section className="card current-card"><p className="eyebrow"><span className="live-dot"/> RIGHT NOW</p><AppBadge name={data.current_app ?? '—'}/><h2>{data.current_app ?? 'Taking a pause'}</h2><p className="muted">{data.current_app ? 'Your current foreground application' : 'No active application being attributed'}</p><div className="current-footer"><span>{status}</span><button onClick={() => setScreen('Timeline')}>View timeline <ArrowUpRight size={14}/></button></div></section></div><div className="dashboard-columns lower"><section className="card"><CardTitle title="Most used applications" detail={`${m.apps.length} applications observed`} action={() => setScreen('Applications')}/><AppUsage apps={m.apps.slice(0, 5)} total={m.active}/></section><section className="card"><CardTitle title="By category" detail="Categories you control"/><CategoryChart categories={m.categories} total={m.active}/></section></div><section className="card"><CardTitle title="Recent activity" detail="A record of your contexts" action={() => setScreen('Timeline')}/><ActivityRows intervals={data.intervals.filter(i => i.end > from && i.start < to).slice(-5).reverse()} from={from} to={to}/></section></>}
 {screen === 'Timeline' && <Timeline data={data} from={from} to={to}/>}
 {screen === 'Applications' && <section className="card"><CardTitle title="Your applications" detail="Usage for the selected day · weekly totals include the preceding six days"/>{data.applications.length === 0 ? <Empty>Your applications will appear as you use them.</Empty> : <div className="table-scroll"><table><thead><tr><th>Application</th><th>Selected day</th><th>7 days</th><th>Contexts</th><th>Category</th><th>Last used</th></tr></thead><tbody>{data.applications.map(a => { const day = m.apps.find(v => v.bundle === a.bundle_id); const weekly = metrics(data.intervals.filter(i => i.bundle_id === a.bundle_id), [], queryFrom, to); return <tr key={a.id}><td><div className="app-name"><AppBadge name={a.name}/><div>{a.name}<small>{a.bundle_id}</small></div></div></td><td>{duration(day?.ms ?? 0)}</td><td>{duration(weekly.active)}</td><td>{day?.sessions ?? 0}</td><td><select aria-label={`${a.name} category`} value={a.category} disabled={busy} onChange={e => void act('categorize', { id: a.id, category: e.target.value })}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></td><td className="muted">{new Date(a.last_seen).toLocaleDateString()}</td></tr>; })}</tbody></table></div>}</section>}
 {screen === 'Focus' && <Focus data={data} now={now} busy={busy} act={act}/>}
 {screen === 'Analytics' && <><div className="metric-grid"><Metric title="Daily active" value={duration(m.active)} detail="Selected calendar day"/><Metric title="7-day active" value={duration(metrics(data.intervals, [], queryFrom, to).active)} detail="Six preceding days + selected day"/><Metric title="Longest active stretch" value={duration(m.longest)} detail="Across adjacent application contexts"/><Metric title="Observed during focus" value={duration(m.observedFocus)} detail="Active intervals ∩ declared sessions"/></div><section className="card"><CardTitle title="A week in perspective" detail="Active computer time by local calendar day"/><WeeklyChart intervals={data.intervals} to={to}/></section><div className="dashboard-columns lower"><section className="card"><CardTitle title="Application usage" detail={`${m.switches} application switches on selected day`}/><AppUsage apps={m.apps} total={m.active}/></section><section className="card"><CardTitle title="Time distribution" detail="Selected day"/><CategoryChart categories={m.categories} total={m.active}/><div className="definition"><strong>{duration(m.idle)} idle · {duration(m.active)} active</strong><p>Focus sessions express your intent. Activity records computer use; neither proves concentration or productivity.</p></div></section></div></>}
 {screen === 'Settings' && <SettingsView data={data} busy={busy} act={act} setError={setError}/>}
 </motion.div><footer className="page-footer"><ShieldCheck size={13}/> Private by design. {signedIn ? 'Activity stays on this Mac. Habits, goals and tasks sync with your Habyss account.' : 'No accounts. No uploads.'}<span>Time is shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></footer></div></main></div>;
}
