import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { SyncStatus } from '../types';
import { CardTitle } from '../components/ui';

export const ago = (iso: string, now = Date.now()) => { const t = Date.parse(iso); if (Number.isNaN(t)) return 'never'; const m = Math.floor((now - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : new Date(t).toLocaleDateString(); };
export function Account() {
    const [status, setStatus] = useState<SyncStatus | null>(null); const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [sent, setSent] = useState(false); const [usePassword, setUsePassword] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
    useEffect(() => { let cancelled = false; let dispose: (() => void) | undefined; invoke<SyncStatus>('cloud_status').then(s => { if (!cancelled) setStatus(s); }).catch(e => setError(String(e))); void listen<SyncStatus>('sync-status', e => setStatus(e.payload)).then(f => { if (cancelled) f(); else dispose = f; }); return () => { cancelled = true; dispose?.(); }; }, []);
    const run = useCallback(async (f: () => Promise<SyncStatus | void>) => { setBusy(true); setError(''); try { const s = await f(); if (s) setStatus(s); else setStatus(await invoke<SyncStatus>('cloud_status')); } catch (e) { setError(String(e)); } finally { setBusy(false); } }, []);
    const send = async () => { setBusy(true); setError(''); try { await invoke('cloud_send_code', { email }); setSent(true); } catch (e) { setError(String(e)); } finally { setBusy(false); } };
    const s = status;
    const body = !s ? <p className="muted">Loading…</p>
        : s.state === 'unconfigured' ? <p className="muted">Sync isn't set up in this build.</p>
        : s.state === 'signed_out' ? <div className="delete-confirm">
            <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
            {usePassword ? <><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)}/></label><button className="primary" disabled={busy || !email || !password} onClick={() => void run(async () => { await invoke('cloud_sign_in_password', { email, password }); setPassword(''); })}>Sign in</button></>
                : <>{sent && <label>6-digit code<input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value)}/></label>}
                    {sent ? <button className="primary" disabled={busy || code.length !== 6} onClick={() => void run(async () => { await invoke('cloud_verify_code', { email, code }); setCode(''); setSent(false); })}>Verify</button> : <button className="primary" disabled={busy || !email} onClick={() => void send()}>Send code</button>}</>}
            <button className="link" onClick={() => setUsePassword(!usePassword)}>{usePassword ? 'Use a code instead' : 'Use a password instead'}</button>
        </div>
        : <>
            <div className="setting-row"><div>{s.email}<small>{s.last_sync ? `Last synced ${ago(s.last_sync)}` : 'Not synced yet'}</small></div><div className="inline"><button disabled={busy || s.state === 'syncing'} onClick={() => void run(() => invoke<SyncStatus>('cloud_sync_now'))}>Sync now</button><button className="danger" disabled={busy} onClick={() => void run(async () => { await invoke('cloud_sign_out'); })}>Sign out</button></div></div>
            {s.pending > 0 && <p className="muted">{s.pending} changes waiting</p>}
            {s.refused > 0 && <p className="muted">{s.refused} changes couldn't sync</p>}
        </>;
    const shown = error || ((s?.state === 'offline' || s?.state === 'error' || s?.error) && s?.error) || '';
    return <section className="card"><CardTitle title="Habyss account" detail="Habits, goals and tasks sync with your account"/>{body}{shown && <p role="alert" className="error">{shown}</p>}</section>;
}
