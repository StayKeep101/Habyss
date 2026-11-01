import { cloudPullPage } from '../cloudPullPage';

function client() {
    const query: any = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'gte', 'or']) query[method] = jest.fn(() => query);
    return { query, sb: { from: jest.fn(() => query) } };
}
it('scopes initial downloads to the account with a bounded, deterministic order', () => {
    const { query, sb } = client();
    cloudPullPage(sb, 'habits', 'user', null, null, 1000);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user');
    expect(query.order.mock.calls).toEqual([['updated_at', { ascending: true }], ['id', { ascending: true }]]);
    expect(query.limit).toHaveBeenCalledWith(1000);
    expect(query.or).not.toHaveBeenCalled();
});
it('includes cursor timestamp ties, then advances by timestamp and id within the download', () => {
    const { query, sb } = client();
    const at = '2026-10-30T12:00:00+00:00';
    cloudPullPage(sb, 'tasks', 'user', at, { updated_at: at, id: 'abc' }, 1000);
    expect(query.gte).toHaveBeenCalledWith('updated_at', at);
    expect(query.or).toHaveBeenCalledWith(`updated_at.gt.${at},and(updated_at.eq.${at},id.gt.abc)`);
});
