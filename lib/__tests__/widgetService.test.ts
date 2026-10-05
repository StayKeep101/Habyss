import { WidgetService } from '../widgetService';
import SharedDefaults from '../SharedDefaults';
import { buildWidgetDashboard } from '../widgetDashboard';

jest.mock('../SharedDefaults', () => ({ __esModule: true, default: {
    set: jest.fn(async () => true), reloadTimelines: jest.fn(async () => true),
} }));

const payload = {
    items: [], completed: 0, total: 0, streak: 0, dayKey: '2026-09-29',
    dashboard: buildWidgetDashboard({ habits: [], tasks: [], history: {}, skips: {},
        today: '2026-09-29', accent: { from: '#112233', to: '#334455' } }),
};
beforeEach(() => jest.clearAllMocks());

it('publishes the shared snapshot before requesting a widget reload', async () => {
    await WidgetService.write(payload);
    expect(SharedDefaults.set).toHaveBeenNthCalledWith(1, 'widgetDashboard', JSON.stringify(payload.dashboard));
    expect((SharedDefaults.set as jest.Mock).mock.invocationCallOrder.at(-1))
        .toBeLessThan((SharedDefaults.reloadTimelines as jest.Mock).mock.invocationCallOrder[0]);
});

it('reports a missing native bridge instead of pretending the widgets were synchronized', async () => {
    (SharedDefaults.set as jest.Mock).mockResolvedValueOnce(false);
    await expect(WidgetService.write(payload)).rejects.toThrow('storage bridge is unavailable');
    expect(SharedDefaults.reloadTimelines).not.toHaveBeenCalled();
});

it('propagates failed publication so pending task actions remain recoverable', async () => {
    (SharedDefaults.set as jest.Mock).mockRejectedValueOnce(new Error('App Group unavailable'));
    await expect(WidgetService.write(payload)).rejects.toThrow('App Group unavailable');
    expect(SharedDefaults.reloadTimelines).not.toHaveBeenCalled();
});
