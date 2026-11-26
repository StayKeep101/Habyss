import { readFileSync } from 'fs';
import { join } from 'path';

const sql = () => readFileSync(join(__dirname, '../../../../supabase/migrations/20261126000100_day_inputs.sql'), 'utf8').toLowerCase().replace(/\s+/g, ' ');

describe('day_inputs migration', () => {
    it('creates an owner-only, per-key table that the database stamps and broadcasts', () => {
        const text = sql();
        for (const part of [
            'create table if not exists public.day_inputs',
            'primary key (user_id, key)',
            'enable row level security',
            'using (user_id = (select auth.uid()))',
            'execute function public.set_updated_at()',
            'execute function public.stamp_server_time()',
            'alter publication supabase_realtime add table public.day_inputs',
            'revoke all on public.day_inputs from anon',
            'on public.day_inputs (user_id, updated_at)',
        ]) expect(text).toContain(part);
    });
});
