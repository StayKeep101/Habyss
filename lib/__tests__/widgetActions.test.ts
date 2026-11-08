import { drainWidgetToggles } from '../widgetSync';
import SharedDefaults from '../SharedDefaults';
import { getCompletions, toggleCompletion } from '../habitsSQLite';
import { setTaskStatus } from '../tasks';
import { WidgetService } from '../widgetService';

const mockEvents = new Map<string, string>();
const mockTasks = [{ id: 'task', status: 'open' }];
const mockCompletions: Record<string, Record<string, boolean>> = {};
jest.mock('../SharedDefaults', () => ({ __esModule: true, default: {
    getPendingWidgetEvents: jest.fn(async () => [...mockEvents.values()]),
    getArray: jest.fn(async () => []), get: jest.fn(async () => '2026-09-26'),
    remove: jest.fn(async (key: string) => { mockEvents.delete(key); return true; }),
    reloadTimelines: jest.fn(async () => true),
} }));
jest.mock('../widgetService', () => ({ WidgetService: { write: jest.fn(async () => {}), writeEcho: jest.fn(async () => {}) } }));
jest.mock('../dailyFocus', () => ({ ...jest.requireActual('../dailyFocus'), getDailyTarget: jest.fn(async () => 3) }));
jest.mock('../habitsSQLite', () => ({
    getHabits: jest.fn(async () => [{ id: 'habit' }]),
    getCompletions: jest.fn(async (day: string) => mockCompletions[day] ?? {}),
    getSkipped: jest.fn(async () => ({})),
    getLastNDaysCompletions: jest.fn(async () => []),
    toggleCompletion: jest.fn(async (id: string, day: string) => {
        mockCompletions[day] = { ...mockCompletions[day], [id]: !mockCompletions[day]?.[id] };
    }),
}));
jest.mock('../tasks', () => ({
    ...jest.requireActual('../tasks'),
    getTasks: jest.fn(async () => mockTasks),
    setTaskStatus: jest.fn(async (id: string, status: string) => { mockTasks.find(task => task.id === id)!.status = status; }),
}));
const add = (eventId: string, id: string, done: boolean, timestamp: number) => mockEvents.set('widget_event_' + eventId,
    JSON.stringify({ eventId, id, done, timestamp, day: '2026-09-25' }));
beforeEach(() => {
    jest.clearAllMocks(); mockEvents.clear(); mockTasks[0].status = 'open';
    for (const key of Object.keys(mockCompletions)) delete mockCompletions[key];
});

it('replays taps chronologically, including an undo, and acknowledges committed events', async () => {
    add('second', 'task:task', false, 2); add('first', 'task:task', true, 1);
    expect(await drainWidgetToggles()).toEqual({ habits: 0, tasks: 2 });
    expect(setTaskStatus).toHaveBeenNthCalledWith(1, 'task', 'done', new Date(1).toISOString());
    expect(setTaskStatus).toHaveBeenNthCalledWith(2, 'task', 'open');
    expect(mockEvents.size).toBe(0);
});
it('logs a habit on the day tapped even after midnight, and duplicate delivery is harmless', async () => {
    add('one', 'habit:habit', true, 1); add('two', 'habit:habit', true, 2);
    await drainWidgetToggles();
    expect(getCompletions).toHaveBeenCalledWith('2026-09-25');
    expect(toggleCompletion).toHaveBeenCalledTimes(1);
    // With the minute it was tapped, so how long it took is kept (lib/learnedLength.ts).
    expect(toggleCompletion).toHaveBeenCalledWith('habit', '2026-09-25', new Date(1).toISOString());
    add('retry', 'habit:habit', true, 3);
    await drainWidgetToggles();
    expect(toggleCompletion).toHaveBeenCalledTimes(1);
});
it('keeps an event after a failed database write so the next launch can retry', async () => {
    add('one', 'task:task', true, 1);
    (setTaskStatus as jest.Mock).mockRejectedValueOnce(new Error('Disk busy'));
    await drainWidgetToggles();
    expect(SharedDefaults.remove).not.toHaveBeenCalled();
    expect(mockEvents.size).toBe(1);
    await drainWidgetToggles();
    expect(mockTasks[0].status).toBe('done');
    expect(mockEvents.size).toBe(0);
});
it('coalesces concurrent foreground drains instead of applying twice', async () => {
    add('one', 'task:task', true, 1);
    await Promise.all([drainWidgetToggles(), drainWidgetToggles()]);
    expect(setTaskStatus).toHaveBeenCalledTimes(1);
});
it('retains the widget overlay until the committed snapshot is published, then retries safely', async () => {
    const tappedAt = Date.parse('2026-09-25T16:00:00Z');
    add('one', 'task:task', true, tappedAt);
    (WidgetService.write as jest.Mock).mockRejectedValueOnce(new Error('Shared storage busy'));
    await drainWidgetToggles();
    expect(mockTasks[0].status).toBe('done');
    expect(setTaskStatus).toHaveBeenCalledWith('task', 'done', '2026-09-25T16:00:00.000Z');
    expect(mockEvents.size).toBe(1);
    expect(SharedDefaults.remove).not.toHaveBeenCalled();
    await drainWidgetToggles();
    expect(mockEvents.size).toBe(0);
    expect(setTaskStatus).toHaveBeenCalledTimes(1);
    expect(WidgetService.write).toHaveBeenCalledTimes(2);
});
