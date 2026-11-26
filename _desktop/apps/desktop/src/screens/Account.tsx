import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { SyncStatus } from '../types';
import { CardTitle } from '../components/ui';

export const ago = (iso: string, now = Date.now()) => { const t = Date.parse(iso); if (Number.isNaN(t)) return 'never'; const m = Math.floor((now - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : new Date(t).toLocaleDateString(); };
/** The email code's length is the server's setting (6 to 10 digits); any of them is accepted. */
export const CODE = /^\d{6,10}$/;
const GoogleMark = () => <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;

export function Account() {
    const [status, setStatus] = useState<SyncStatus | null>(null); const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [sent, setSent] = useState(false); const [usePassword, setUsePassword] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [browser, setBrowser] = useState<'apple' | 'google' | null>(null);
    useEffect(() => { let cancelled = false; let dispose: (() => void) | undefined; invoke<SyncStatus>('cloud_status').then(s => { if (!cancelled) setStatus(s); }).catch(e => setError(String(e))); void listen<SyncStatus>('sync-status', e => setStatus(e.payload)).then(f => { if (cancelled) f(); else dispose = f; }); return () => { cancelled = true; dispose?.(); }; }, []);
    const run = useCallback(async (f: () => Promise<SyncStatus | void>) => { setBusy(true); setError(''); try { const s = await f(); if (s) setStatus(s); else setStatus(await invoke<SyncStatus>('cloud_status')); } catch (e) { setError(String(e)); } finally { setBusy(false); } }, []);
    const send = async () => { setBusy(true); setError(''); try { await invoke('cloud_send_code', { email }); setSent(true); } catch (e) { setError(String(e)); } finally { setBusy(false); } };
    // Apple or Google: finished in the browser, which comes back to the app (cloud/oauth.rs).
    const signInWith = async (provider: 'apple' | 'google') => { setBrowser(provider); setError(''); try { await invoke('cloud_sign_in_with', { provider }); setStatus(await invoke<SyncStatus>('cloud_status')); } catch (e) { setError(String(e)); } finally { setBrowser(b => (b === provider ? null : b)); } };
    const s = status;
    const body = !s ? <p className="muted">Loading…</p>
        : s.state === 'unconfigured' ? <p className="muted">Sync isn't set up in this build.</p>
        : s.state === 'signed_out' ? <div className="sync-form">
            <div className="sign-in-with">
                <button className="apple" disabled={busy} onClick={() => void signInWith('apple')}><span aria-hidden="true"></span>Sign in with Apple</button>
                <button disabled={busy} onClick={() => void signInWith('google')}><GoogleMark />Sign in with Google</button>
            </div>
            {browser && <p className="muted wide">Finish signing in with {browser === 'apple' ? 'Apple' : 'Google'} in your browser.</p>}
            <label>Email<input type="email" disabled={sent} value={email} onChange={e => setEmail(e.target.value)}/></label>
            {usePassword ? <><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)}/></label><button className="primary" disabled={busy || !email || !password} onClick={() => void run(async () => { await invoke('cloud_sign_in_password', { email, password }); setPassword(''); })}>Sign in</button></>
                : <>{sent && <label>Code from your email<input inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={e => setCode(e.target.value.replace(/\s/g, ''))}/></label>}
                    {sent && <button onClick={() => { setSent(false); setCode(''); setError(''); }}>Use a different email</button>}
                    {sent ? <button className="primary" disabled={busy || !CODE.test(code)} onClick={() => void run(async () => { await invoke('cloud_verify_code', { email, code }); setCode(''); setSent(false); })}>Verify</button> : <button className="primary" disabled={busy || !email} onClick={() => void send()}>Send code</button>}</>}
            <button className="link" onClick={() => setUsePassword(!usePassword)}>{usePassword ? 'Use a code instead' : 'Use a password instead'}</button>
        </div>
        : <>
            <div className="setting-row"><div>{s.email}<small>{s.last_sync ? `Last synced ${ago(s.last_sync)}` : 'Not synced yet'}</small></div><div className="inline"><button disabled={busy || s.state === 'syncing'} onClick={() => void run(() => invoke<SyncStatus>('cloud_sync_now'))}>Sync now</button><button className="danger" disabled={busy} onClick={() => void run(async () => { await invoke('cloud_sign_out'); })}>Sign out</button></div></div>
            {s.pending > 0 && <p className="muted">{s.pending} changes waiting</p>}
            {s.refused > 0 && <p className="muted">{s.refused} changes couldn't sync</p>}
        </>;
    const shown = error || s?.error || '';
    return <section className="card"><CardTitle title="Habyss account" detail="Habits and tasks sync with your account"/>{body}{shown && <p role="alert" className="error">{shown}</p>}</section>;
}
