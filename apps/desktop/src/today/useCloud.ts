import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CloudData, SyncStatus } from '../types';
import { localDateKey } from '../shared/habitSchedule';
const HISTORY_DAYS = 400;
export function useCloud(): { data: CloudData | null; status: SyncStatus | null; refresh(): Promise<void>; setLocal(mutate: (d: CloudData) => CloudData): void } {
    const [data, setData] = useState<CloudData | null>(null);
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const alive = useRef(true);
    const refresh = useCallback(async () => {
        if (!isTauri())
            return;
        const since = new Date();
        since.setDate(since.getDate() - HISTORY_DAYS);
        try {
            const [d, s] = await Promise.all([invoke<CloudData>('cloud_data', { completionsSince: localDateKey(since) }), invoke<SyncStatus>('cloud_status')]);
            if (alive.current) {
                setData(d);
                setStatus(s);
            }
        }
        catch { /* keep what is shown; the next event retries */ }
    }, []);
    useEffect(() => {
        alive.current = true;
        void refresh();
        const disposers: (() => void)[] = [];
        let cancelled = false;
        if (isTauri()) {
            for (const name of ['cloud-changed', 'sync-status'])
                void listen(name, () => void refresh()).then(f => { if (cancelled)
                    f();
                else
                    disposers.push(f); });
        }
        const onVisible = () => { if (!document.hidden)
            void refresh(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { cancelled = true; alive.current = false; disposers.forEach(f => f()); document.removeEventListener('visibilitychange', onVisible); };
    }, [refresh]);
    const setLocal = useCallback((mutate: (d: CloudData) => CloudData) => setData(d => (d ? mutate(d) : d)), []);
    return { data, status, refresh, setLocal };
}
