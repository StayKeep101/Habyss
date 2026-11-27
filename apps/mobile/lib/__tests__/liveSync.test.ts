import { readFileSync } from 'fs';
import { join } from 'path';
import { LIVE_TABLES, watchAccount } from '../dayInputsSync';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

/** Every table both apps sync (packages/schema) reaches this phone live when another device changes it. */
const { tables } = require('../../../../packages/schema/src/tables.json') as { tables: Record<string, unknown> };

describe('another device’s changes arrive live', () => {
    it('listens to every synced table and the day’s settings, for this account only', () => {
        const listened: { table: string; filter: string }[] = [];
        const channel: any = { on: (_kind: string, spec: { table: string; filter: string }) => { listened.push(spec); return channel; }, subscribe: jest.fn() };
        const sb = { channel: jest.fn(() => channel), removeChannel: jest.fn() };
        const stop = watchAccount(sb, 'user-1');
        expect(listened.map(l => l.table).sort()).toEqual([...Object.keys(tables), 'day_inputs'].sort());
        expect(listened.every(l => l.filter === 'user_id=eq.user-1')).toBe(true);
        expect(channel.subscribe).toHaveBeenCalled();
        stop();
        expect(sb.removeChannel).toHaveBeenCalledWith(channel);
    });

    it('the server broadcasts each of them', () => {
        const sql = readFileSync(join(__dirname, '../../../../supabase/migrations/20261126000200_realtime_sync.sql'), 'utf8');
        for (const table of LIVE_TABLES.filter(t => t !== 'day_inputs')) expect(sql).toContain(`'${table}'`);
    });
});
