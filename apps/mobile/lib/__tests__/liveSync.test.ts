import { readFileSync } from 'fs';
import { join } from 'path';
import { LIVE_TABLES, syncTopic, watchAccount } from '../dayInputsSync';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

/** Every table both apps sync (packages/schema) signals the account's other devices when it changes. */
const { tables } = require('../../../../packages/schema/src/tables.json') as { tables: Record<string, unknown> };
const migration = () => readFileSync(join(__dirname, '../../../../supabase/migrations/20261126000400_realtime_broadcast.sql'), 'utf8');

describe('another device’s changes arrive live', () => {
    it('listens on the account’s private channel for change signals', () => {
        const calls: unknown[][] = [];
        const channel: any = { on: (...args: unknown[]) => { calls.push(args); return channel; }, subscribe: jest.fn(() => channel) };
        const sb = { channel: jest.fn(() => channel), removeChannel: jest.fn() };
        const stop = watchAccount(sb, 'user-1');
        expect(sb.channel).toHaveBeenCalledWith('sync:user-1', { config: { private: true } });
        expect(calls).toEqual([['broadcast', { event: 'changed' }, expect.any(Function)]]);
        stop();
        expect(sb.removeChannel).toHaveBeenCalledWith(channel);
    });

    it('every synced table signals, on the same topic, and only its account may listen', () => {
        const sql = migration();
        expect([...LIVE_TABLES].sort()).toEqual([...Object.keys(tables), 'day_inputs'].sort());
        for (const table of LIVE_TABLES) expect(sql).toContain(`'${table}'`);
        expect(sql).toContain(`'sync:' || uid::text`);
        expect(syncTopic('u')).toBe('sync:u');
        expect(sql).toContain(`realtime.topic() = 'sync:' || (select auth.uid())::text`);
        // Broadcast, not Postgres Changes: those tables leave the publication.
        expect(sql).toContain('alter publication supabase_realtime drop table');
    });
});
