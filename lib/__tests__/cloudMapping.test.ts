import {
    chunk, completionToLocal, completionToRemote, dateOnly, habitToLocal, habitToRemote,
    isUuid, orderForUpload, parseJson, taskToLocal, taskToRemote,
} from '../cloudMapping';

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const HABIT = '11111111-0000-4000-8000-000000000001';
const GOAL = '22222222-0000-4000-8000-000000000002';

const localHabit = {
    id: HABIT, user_id: 'old-local-id', name: ' Evening run ', description: 'After work',
    category: 'body', icon: 'walk-outline', is_goal: 0, target_date: null, goal_id: GOAL,
    task_days: '["mon","wed"]', reminders: '["18:00"]', start_date: '2026-09-18', end_date: null,
    duration_minutes: 30, start_time: '18:00', end_time: null, type: 'build', color: '#10B981',
    goal_period: 'daily', goal_value: 3.6, unit: 'km', chart_type: 'bar', is_archived: 0,
    show_memo: 1, frequency: 'daily', week_interval: 1, time_of_day: 'evening',
    graph_style: 'progress', tracking_method: 'numeric', reminder_offset: 10,
    reminder_message: 'Shoes on. Ten minutes is enough.',
    recurrence: '{"kind":"monthly","every":2,"ordinal":3,"day":"sun"}',
    location_reminders: '[{"name":"Gym","latitude":1,"longitude":2}]', health_kit_metric: null,
    health_kit_target: null, ringtone: 'default', goal_spec: '{"type":"volume","target":50}',
    created_at: '2026-09-18T10:00:00.000Z', updated_at: '2026-09-18T11:00:00.000Z',
    synced: 0, deleted: 0,
};

describe('habits, phone to server', () => {
    const remote = habitToRemote(localHabit, USER);

    it('uploads under the signed-in account, not the old local id', () => {
        expect(remote.user_id).toBe(USER);
    });

    it('turns 0/1 into real booleans and JSON text into structures', () => {
        expect(remote.is_goal).toBe(false);
        expect(remote.show_memo).toBe(true);
        expect(remote.task_days).toEqual(['mon', 'wed']);
        expect(remote.reminders).toEqual(['18:00']);
        expect(remote.location_reminders).toEqual([{ name: 'Gym', latitude: 1, longitude: 2 }]);
        expect(remote.goal_spec).toEqual({ type: 'volume', target: 50 });
    });

    it('keeps a decimal target, which the old server rejected', () => {
        expect(remote.goal_value).toBe(3.6);
        expect(remote.tracking_method).toBe('numeric');
    });

    it('trims the name and never sends it empty', () => {
        expect(remote.name).toBe('Evening run');
        expect(habitToRemote({ ...localHabit, name: '   ' }, USER).name).toBe('Untitled');
    });

    it('carries the rule it repeats on and the sentence its reminder says', () => {
        // Both were held out of the mapping while the server had no column for
        // them; a habit that came back from a backup without its recurrence
        // would be restored as whatever the legacy columns alone describe.
        expect(remote.recurrence).toBe('{"kind":"monthly","every":2,"ordinal":3,"day":"sun"}');
        expect(remote.reminder_message).toBe('Shoes on. Ten minutes is enough.');
    });

    it('sends null for a habit that has neither', () => {
        const bare = habitToRemote({ ...localHabit, recurrence: undefined, reminder_message: undefined }, USER);
        expect(bare.recurrence).toBeNull();
        expect(bare.reminder_message).toBeNull();
    });

    it('maps a local deletion to a deletion time', () => {
        expect(remote.deleted_at).toBeNull();
        expect(habitToRemote({ ...localHabit, deleted: 1 }, USER).deleted_at).toBe(localHabit.updated_at);
    });

    it('stores deadlines as calendar dates whatever shape they were in', () => {
        expect(habitToRemote({ ...localHabit, target_date: '2026-09-30T00:00:00.000Z' }, USER).target_date).toBe('2026-09-30');
        expect(habitToRemote({ ...localHabit, target_date: '2026-09-30' }, USER).target_date).toBe('2026-09-30');
    });
});

describe('habits are cleaned so one bad row cannot block a backup', () => {
    it('replaces values the server would reject', () => {
        const remote = habitToRemote({
            ...localHabit,
            tracking_method: 'weird', graph_style: 'pie', week_interval: 0,
            goal_value: -3, duration_minutes: -5, category: '', goal_id: 'not-a-uuid',
        }, USER);
        expect(remote.tracking_method).toBe('boolean');
        expect(remote.graph_style).toBeNull();
        expect(remote.week_interval).toBe(1);
        expect(remote.goal_value).toBe(1);
        expect(remote.duration_minutes).toBeNull();
        expect(remote.category).toBe('personal');
        expect(remote.goal_id).toBeNull();
    });

    it('survives malformed JSON', () => {
        const remote = habitToRemote({ ...localHabit, task_days: '[oops', goal_spec: '{' }, USER);
        expect(remote.task_days).toEqual([]);
        expect(remote.goal_spec).toBeNull();
    });
});

describe('habits, server to phone', () => {
    it('round-trips without losing anything the app uses', () => {
        const back = habitToLocal({ ...habitToRemote(localHabit, USER), user_id: USER });
        expect(back).toMatchObject({
            id: HABIT, user_id: USER, name: 'Evening run', goal_value: 3.6, unit: 'km',
            tracking_method: 'numeric', is_goal: 0, show_memo: 1, goal_id: GOAL, deleted: 0,
        });
        expect(JSON.parse(back.task_days)).toEqual(['mon', 'wed']);
        expect(JSON.parse(back.goal_spec)).toEqual({ type: 'volume', target: 50 });
        // The rule comes back as the text the phone stores, key order and all,
        // which is why it is text on the server rather than jsonb.
        expect(back.recurrence).toBe(localHabit.recurrence);
        expect(back.reminder_message).toBe(localHabit.reminder_message);
    });

    it('marks what came from the server as already backed up', () => {
        expect(habitToLocal(habitToRemote(localHabit, USER)).synced).toBe(1);
    });

    it('turns a server deletion into a local one', () => {
        expect(habitToLocal({ ...habitToRemote(localHabit, USER), deleted_at: '2026-09-18T12:00:00Z' }).deleted).toBe(1);
    });
});

describe('completions', () => {
    const local = {
        id: '33333333-0000-4000-8000-000000000003', user_id: 'old', habit_id: HABIT,
        date: '2026-09-18', value: 3.6, memo: null, created_at: '2026-09-18T19:00:00.000Z',
        updated_at: null, synced: 0, deleted: 0,
    };

    it('uploads under the account with a decimal value', () => {
        const remote = completionToRemote(local, USER);
        expect(remote).toMatchObject({ user_id: USER, habit_id: HABIT, date: '2026-09-18', value: 3.6, completed: true });
    });

    it('falls back to the creation time when there is no update time', () => {
        expect(completionToRemote(local, USER).updated_at).toBe(local.created_at);
    });

    it('records an un-ticked day as deleted', () => {
        expect(completionToRemote({ ...local, deleted: 1 }, USER).deleted_at).toBe(local.created_at);
    });

    it('treats a server row marked not completed as removed', () => {
        expect(completionToLocal({ ...completionToRemote(local, USER), completed: false }).deleted).toBe(1);
    });

    it('round-trips', () => {
        expect(completionToLocal(completionToRemote(local, USER))).toMatchObject({
            habit_id: HABIT, date: '2026-09-18', value: 3.6, deleted: 0, synced: 1,
        });
    });
});

describe('tasks', () => {
    const local = {
        id: '44444444-0000-4000-8000-000000000004', user_id: 'old', title: ' Buy shoes ',
        description: null, due_date: '2026-09-20', due_time: '18:30', estimated_minutes: 45,
        priority: 1, goal_id: GOAL, status: 'open', completed_at: null, source: 'app',
        external_id: 'onboarding:x:checkpoint_1', created_at: '2026-09-18T10:00:00.000Z',
        updated_at: '2026-09-18T10:00:00.000Z', deleted: 0, synced: 0,
    };

    it('uploads with the fields that decide what matters today', () => {
        expect(taskToRemote(local, USER)).toMatchObject({
            user_id: USER, title: 'Buy shoes', due_date: '2026-09-20', due_time: '18:30',
            estimated_minutes: 45, priority: 1, goal_id: GOAL, external_id: 'onboarding:x:checkpoint_1',
        });
    });

    it('cleans values the server would reject', () => {
        const remote = taskToRemote({
            ...local, due_time: '25:99', priority: 9, estimated_minutes: -1,
            status: 'weird', source: 'weird', title: '  ',
        }, USER);
        expect(remote).toMatchObject({
            due_time: null, priority: 2, estimated_minutes: null, status: 'open', source: 'app', title: 'Untitled task',
        });
    });

    it('round-trips', () => {
        expect(taskToLocal(taskToRemote(local, USER))).toMatchObject({
            title: 'Buy shoes', due_time: '18:30', priority: 1, deleted: 0, synced: 1,
        });
    });
});

describe('upload order', () => {
    it('sends goals before the habits that point at them', () => {
        const { upload } = orderForUpload([
            { id: HABIT, is_goal: 0 },
            { id: GOAL, is_goal: 1 },
        ]);
        expect(upload.map(r => r.id)).toEqual([GOAL, HABIT]);
    });

    it('sets aside rows whose id the server cannot accept', () => {
        const { upload, skipped } = orderForUpload([{ id: 'legacy-id', is_goal: 0 }, { id: HABIT, is_goal: 0 }]);
        expect(upload.map(r => r.id)).toEqual([HABIT]);
        expect(skipped.map(r => r.id)).toEqual(['legacy-id']);
    });
});

describe('helpers', () => {
    it('recognises the ids the app generates', () => {
        expect(isUuid(HABIT)).toBe(true);
        expect(isUuid('old-local-id')).toBe(false);
        expect(isUuid(null)).toBe(false);
    });

    it('reads a date from either shape and refuses garbage', () => {
        expect(dateOnly('2026-09-18')).toBe('2026-09-18');
        expect(dateOnly('2026-09-18T23:00:00Z')).toBe('2026-09-18');
        expect(dateOnly('nonsense')).toBeNull();
        expect(dateOnly(null)).toBeNull();
    });

    it('parses JSON safely', () => {
        expect(parseJson('["a"]', [])).toEqual(['a']);
        expect(parseJson('{bad', [])).toEqual([]);
        expect(parseJson(['already'], [])).toEqual(['already']);
    });

    it('splits work into batches', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunk([], 2)).toEqual([]);
    });
});

describe('rows written by older versions of the app', () => {
    it('shows legacy amount-tracking habits as amounts', () => {
        for (const legacy of ['quantity', 'duration', 'rating']) {
            expect(habitToLocal({ id: HABIT, user_id: USER, name: 'x', tracking_method: legacy }).tracking_method).toBe('numeric');
        }
        expect(habitToLocal({ id: HABIT, user_id: USER, name: 'x', tracking_method: 'boolean' }).tracking_method).toBe('boolean');
        expect(habitToLocal({ id: HABIT, user_id: USER, name: 'x' }).tracking_method).toBe('boolean');
    });
});
