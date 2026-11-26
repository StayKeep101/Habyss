import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CloudData, SyncStatus } from '../types';
import { localDateKey } from '../shared/habitSchedule';
const HISTORY_DAYS = 400;
/** Signed in on this Mac, from the durable `account` flag, never from the sync pass state (which reads "syncing" or "signed_out" mid-pass).
 * A null status is still loading: callers show neither the sign-in prompt nor numbers until it arrives. */
export function isSignedIn(status: SyncStatus | null): boolean {
    return status !== null && status.state !== 'unconfigured' && status.account;
}
export type Cloud = ReturnType<typeof useCloud>;
export function useCloud(): { data: CloudData | null; status: SyncStatus | null; error: string | null; loading: boolean; refresh(): Promise<void>; setLocal(mutate: (d: CloudData) => CloudData): void } {
    const [data, setData] = useState<CloudData | null>(null);
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(isTauri());
    const alive = useRef(true);
    const dataSeq = useRef(0);
    const statusSeq = useRef(0);
    const loadData = useCallback(async () => {
        const seq = ++dataSeq.current;
        const since = new Date();
        since.setDate(since.getDate() - HISTORY_DAYS);
        try {
            const d = await invoke<CloudData>('cloud_data', { completionsSince: localDateKey(since) });
            if (alive.current && seq === dataSeq.current) {
                setData(d);
                setError(null);
            }
        }
        catch (e) {
            console.error('cloud_data failed', e);
            if (alive.current && seq === dataSeq.current)
                setError(String(e));
        }
        finally {
            if (alive.current && seq === dataSeq.current)
                setLoading(false);
        }
    }, []);
    const loadStatus = useCallback(async () => {
        const seq = ++statusSeq.current;
        try {
            const s = await invoke<SyncStatus>('cloud_status');
            if (alive.current && seq === statusSeq.current)
                setStatus(s);
        }
        catch (e) {
            console.error('cloud_status failed', e);
        }
    }, []);
    const refresh = useCallback(async () => {
        if (!isTauri())
            return;
        await Promise.all([loadData(), loadStatus()]);
    }, [loadData, loadStatus]);
    useEffect(() => {
        alive.current = true;
        void refresh();
        const disposers: (() => void)[] = [];
        let cancelled = false;
        if (isTauri()) {
            const on = (name: string, run: () => void) => void listen(name, run).then(f => { if (cancelled)
                f();
            else
                disposers.push(f); });
            on('cloud-changed', () => void loadData());
            on('sync-status', () => void loadStatus());
        }
        const onVisible = () => { if (!document.hidden)
            void loadData(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { cancelled = true; alive.current = false; disposers.forEach(f => f()); document.removeEventListener('visibilitychange', onVisible); };
    }, [refresh, loadData, loadStatus]);
    const setLocal = useCallback((mutate: (d: CloudData) => CloudData) => setData(d => (d ? mutate(d) : d)), []);
    return useMemo(() => ({ data, status, error, loading, refresh, setLocal }), [data, status, error, loading, refresh, setLocal]);
}
