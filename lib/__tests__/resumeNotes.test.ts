import { clearResumeNote, loadResumeNotes, resumeNoteOf, setResumeNote } from '../resumeNotes';

describe('where to pick up', () => {
    it('keeps one note per item, replaced, emptied and cleared when done', async () => {
        await loadResumeNotes();
        await setResumeNote('t1', '  finish slide 4  ');
        expect(resumeNoteOf('t1')).toBe('finish slide 4');
        await setResumeNote('t1', 'slide 5');
        expect(resumeNoteOf('t1')).toBe('slide 5');
        await setResumeNote('t1', '   ');
        expect(resumeNoteOf('t1')).toBeNull();
        await setResumeNote('t2', 'page 30');
        await clearResumeNote('t2');
        expect(resumeNoteOf('t2')).toBeNull();
    });
});
