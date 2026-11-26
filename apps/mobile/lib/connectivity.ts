import { useEffect, useState } from 'react';

/**
 * Whether the phone can reach the internet, and a hook that follows it.
 *
 * Habyss works offline; only Community (and backup) needs a connection, so
 * this is how those places know to say so rather than look broken.
 * Unknown counts as online: a missing native module must not hide Community.
 */
type Network = typeof import('expo-network');

function network(): Network | null {
    try { return require('expo-network') as Network; } catch { return null; }
}

const reachable = (state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) =>
    state.isConnected !== false && state.isInternetReachable !== false;

export async function isOnline(): Promise<boolean> {
    const net = network();
    if (!net) return true;
    try { return reachable(await net.getNetworkStateAsync()); } catch { return true; }
}

export function useOnline(): boolean {
    const [online, setOnline] = useState(true);
    useEffect(() => {
        const net = network();
        if (!net) return;
        void isOnline().then(setOnline);
        try {
            const subscription = net.addNetworkStateListener(state => setOnline(reachable(state)));
            return () => subscription.remove();
        } catch {
            return undefined;
        }
    }, []);
    return online;
}

/** A line for when Community cannot reach anyone. One per pull, in turn. */
export const OFFLINE_LINES = [
    'Alone in this world',
    'No internet. Just you and your habits.',
    'Your friends are out there. Somewhere. Online.',
    'The Wi-Fi left you on read',
    'Off the grid. Very mysterious.',
    'Even Echo can’t reach anyone',
    'Perfect time to do a habit, honestly',
    'Pulling harder won’t find a signal',
    'Somewhere a router is blinking at you',
    'Peace and quiet, enforced',
];
