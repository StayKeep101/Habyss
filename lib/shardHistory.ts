import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalUserId } from './localUser';
import { shardEventKey } from './shards';
import type { MarkEvent } from './marks';

/** Keep consumed earning slots even after undo/delete; never reallocate them to new items. */
let writing: Promise<MarkEvent[]> = Promise.resolve([]);
export function rememberShardEarnings(ledger: MarkEvent[]): Promise<MarkEvent[]> {
    const next = writing.catch(() => []).then(async () => {
        const user = await getLocalUserId();
        const key = `habyss_shard_allowance:${user}`;
        const raw = await AsyncStorage.getItem(key);
        const previous: MarkEvent[] = raw ? JSON.parse(raw) : [];
        const events = new Map(previous.map(event => [shardEventKey(event), event]));
        for (const event of ledger) {
            if (event.points <= 0 || event.item === 'mission') continue;
            const old = events.get(shardEventKey(event));
            if (!old || event.points > old.points) events.set(shardEventKey(event), event);
        }
        const history = [...events.values()];
        await AsyncStorage.setItem(key, JSON.stringify(history));
        return history;
    });
    writing = next;
    return next;
}
