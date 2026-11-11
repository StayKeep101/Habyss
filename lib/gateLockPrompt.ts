import { Alert } from 'react-native';
import { askToUnlock, currentLock, relock, type LockState } from './gateLock';

/** "Tuesday 2:00 PM": when a request to unlock opens or closes. */
export const lockMoment = (at: number) => new Date(at).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });

/** The lock's state in a word or two, for the row that shows it. */
export function lockLabel(state: LockState): string {
    if (state.kind === 'waiting') return `Unlocks ${lockMoment(state.opensAt)}`;
    if (state.kind === 'open') return `Open until ${lockMoment(state.closesAt)}`;
    return 'Locked';
}

/**
 * Earn your scroll and the Bedtime lock are hard locks (lib/gateLock.ts):
 * switching one off, or changing the blocked apps, waits a day after you ask.
 * Open, the change is made and it locks again; otherwise this asks, or says
 * when it opens and offers to take the request back.
 */
export async function throughLock(change: () => Promise<unknown>, onChanged?: () => void): Promise<void> {
    const state = await currentLock();
    if (state.kind === 'open') { await change(); await relock(); onChanged?.(); return; }
    if (state.kind === 'waiting') {
        Alert.alert('Unlocking', `You can change it ${lockMoment(state.opensAt)}.`, [
            { text: 'Keep it locked', onPress: () => { void relock().then(onChanged); } },
            { text: 'OK', style: 'cancel' },
        ]);
        return;
    }
    Alert.alert('Locked', 'Your apps stay blocked. Ask to unlock and you can change this in 24 hours.', [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Ask to unlock', style: 'destructive',
            onPress: () => { void askToUnlock().then(at => { onChanged?.(); Alert.alert('Unlock asked', `You can change it ${lockMoment(at)}. Until then, nothing changes.`); }); },
        },
    ]);
}
