import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Snapshot } from './types';
import { dayRange, localDate } from './analytics';
import { Onboarding } from './screens/Onboarding';
import { MenuPanel } from './panel/MenuPanel';
import { Shell } from './shell/Shell';
import { applyTheme, themeForAppearance } from './theme/css';
const panel = new URLSearchParams(location.search).has('panel');
export default function App() {
    const [date, setDate] = useState(localDate());
    const [data, setData] = useState<Snapshot | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(Date.now());
    const lastToday = useRef(localDate());
    useEffect(() => { const today = localDate(new Date(now)); if (today !== lastToday.current) {
        if (date === lastToday.current)
            setDate(today);
        lastToday.current = today;
    } }, [now, date]);
    const [from, to] = dayRange(date);
    const queryFrom = new Date(new Date(from).setDate(new Date(from).getDate() - 6)).getTime();
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
    useEffect(() => { const mode = data?.settings.appearance ?? 'dark'; const apply = () => applyTheme(themeForAppearance(mode)); apply(); if (mode !== 'system') return; const mq = matchMedia('(prefers-color-scheme: light)'); mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply); }, [data?.settings.appearance]);
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
    if (panel)
        return <MenuPanel/>;
    if (!isTauri())
        return <div className="connection"><img src="/logo.png" alt=""/><h1>Habyss Desktop</h1><p>Open the native macOS app to view your activity.</p><p>This browser preview has no access to the tracking engine. No sample activity is displayed.</p><code>bun run dev</code></div>;
    if (!data)
        return <div className="connection"><img src="/logo.png" alt=""/><h1>Opening your day</h1><p>{error || 'Connecting to the local tracking engine…'}</p>{error && <button onClick={() => void refresh()}>Try again</button>}</div>;
    if (!data.settings.onboarding_complete)
        return <Onboarding data={data} busy={busy} error={error} act={act}/>;
    return <Shell data={data} act={act} busy={busy} error={error} setError={setError} date={date} setDate={setDate} now={now}/>;
}
