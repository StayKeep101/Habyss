import { thoughtsAsMarkdown } from '../thoughtExport';

describe('exporting the brain dump', () => {
    const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();
    it('one thought goes as its words', () => {
        expect(thoughtsAsMarkdown([{ id: '1', text: ' call the bank ', createdAt: at(3, 9) }])).toBe('call the bank');
    });
    it('several go as Markdown: a heading per day, a bullet per thought, oldest first', () => {
        const text = thoughtsAsMarkdown([
            { id: '2', text: 'ideas for the app\nmore color', createdAt: at(3, 9) },
            { id: '1', text: 'book dentist', createdAt: at(2, 18) },
        ]);
        expect(text.startsWith('# Brain dump\n\n## ')).toBe(true);
        expect(text.indexOf('book dentist')).toBeLessThan(text.indexOf('ideas for the app'));
        expect(text).toContain('- ideas for the app\n  more color');
    });
});
