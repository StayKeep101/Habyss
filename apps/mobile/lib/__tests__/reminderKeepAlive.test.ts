import { keepAliveAt } from '../reminderKeepAlive';

describe('keepAliveAt', () => {
    it('is nothing when nothing is booked', () => {
        expect(keepAliveAt([])).toBeNull();
    });
    it('comes half an hour after the last booked reminder, whatever the order', () => {
        const at = keepAliveAt([{ date: new Date(2026, 9, 30, 9) }, { date: new Date(2026, 10, 2, 20) }, { date: new Date(2026, 9, 27, 8) }]);
        expect(at).toEqual(new Date(2026, 10, 2, 20, 30));
    });
});
