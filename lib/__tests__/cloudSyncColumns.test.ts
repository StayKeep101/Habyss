jest.mock('../supabase', () => ({ getSupabase: () => null, isCloudConfigured: () => false }));
jest.mock('../database', () => ({ getDatabase: jest.fn(), isSQLiteAvailable: () => false }));
jest.mock('../habitsSQLite', () => ({ reloadHabitsFromStorage: jest.fn() }));

import { missingColumnFrom, missingTableFrom } from '../cloudSync';

describe('a database that has not had the update applied', () => {
    it('recognises what Postgres says', () => {
        expect(missingColumnFrom({ message: 'column "goal_spec" of relation "habits" does not exist' })).toBe('goal_spec');
        expect(missingColumnFrom({ message: 'column habits.ringtone does not exist' })).toBe('ringtone');
    });

    it('recognises what PostgREST says', () => {
        expect(missingColumnFrom({ message: "Could not find the 'health_kit_metric' column of 'habits' in the schema cache" }))
            .toBe('health_kit_metric');
    });

    it('does not mistake other failures for a missing column', () => {
        expect(missingColumnFrom({ message: 'new row violates row-level security policy' })).toBeNull();
        expect(missingColumnFrom({ message: 'network request failed' })).toBeNull();
        expect(missingColumnFrom(undefined)).toBeNull();
    });
});

describe('a database with no such table at all', () => {
    it('recognises what PostgREST and Postgres say', () => {
        expect(missingTableFrom({
            code: 'PGRST205',
            message: "Could not find the table 'public.tasks' in the schema cache",
        })).toBe(true);
        expect(missingTableFrom({ code: '42P01', message: 'relation "public.tasks" does not exist' })).toBe(true);
    });

    it('does not mistake a missing column, or anything else, for a missing table', () => {
        // A missing column is recoverable by dropping it; a missing table is not.
        expect(missingTableFrom({ message: 'column habits.ringtone does not exist' })).toBe(false);
        expect(missingTableFrom({ message: 'new row violates row-level security policy' })).toBe(false);
        expect(missingTableFrom({ message: 'network request failed' })).toBe(false);
        expect(missingTableFrom(undefined)).toBe(false);
    });
});
