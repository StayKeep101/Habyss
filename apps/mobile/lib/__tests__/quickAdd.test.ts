import { parseQuickAdd, quickAddSummary } from '../shortcutsInbox';

describe('adding without opening the app', () => {
    it('reads every kind queued by Siri, a Shortcut or the widget', () => {
        expect(parseQuickAdd('task|Call the bank')).toEqual({ kind: 'task', title: 'Call the bank' });
        // An older build's Goal tile: read like anything said.
        expect(parseQuickAdd('goal|Read 12 books this year')).toEqual({ kind: 'any', title: 'Read 12 books this year' });
        expect(parseQuickAdd('braindump|An idea')).toEqual({ kind: 'thought', title: 'An idea' });
        expect(parseQuickAdd('any|call mom and also run every morning')).toEqual({ kind: 'any', title: 'call mom and also run every morning' });
        expect(parseQuickAdd('task|   ')).toBeNull();
        expect(parseQuickAdd('nonsense')).toBeNull();
    });
    it('says what was added in one line', () => {
        expect(quickAddSummary({ tasks: ['Call bank'], habits: [], thoughts: [] })).toBe('Added Call bank to today.');
        expect(quickAddSummary({ tasks: ['Call bank'], habits: ['Run'], thoughts: ['x'] }))
            .toBe('Added Call bank to today, the habit Run and a thought to your brain dump.');
        expect(quickAddSummary({ tasks: [], habits: [], thoughts: [] })).toBeNull();
    });
});
