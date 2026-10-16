import { reviewTime, startOfWeek } from '../weekStart';
import { keptThisWeek } from '../brainDump';

describe('the week', () => {
    // Thursday 16 October 2026.
    const thursday = new Date(2026, 9, 16, 15, 0);

    it('starts on Monday or Sunday, as chosen', () => {
        expect(startOfWeek(thursday, 'monday')).toEqual(new Date(2026, 9, 12));
        expect(startOfWeek(thursday, 'sunday')).toEqual(new Date(2026, 9, 11));
        expect(startOfWeek(new Date(2026, 9, 11, 9), 'monday')).toEqual(new Date(2026, 9, 5));
    });

    it('reviews the brain dump at 7 pm on the last day of the week', () => {
        expect(reviewTime(thursday, 'monday')).toEqual(new Date(2026, 9, 18, 19, 0));
        expect(reviewTime(thursday, 'sunday')).toEqual(new Date(2026, 9, 17, 19, 0));
    });

    it('keeps only this week’s thoughts when a new week starts', () => {
        const thoughts = [
            { id: 'a', text: 'old', createdAt: new Date(2026, 9, 10, 12).toISOString() },
            { id: 'b', text: 'new', createdAt: new Date(2026, 9, 13, 12).toISOString() },
        ];
        expect(keptThisWeek(thoughts, startOfWeek(thursday, 'monday')).map(item => item.id)).toEqual(['b']);
    });
});
