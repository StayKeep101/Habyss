import { useEffect, useSyncExternalStore } from 'react';
import { currentResumeNotes, loadResumeNotes, subscribeResumeNotes, type ResumeNote } from '@/lib/resumeNotes';

/** Every "where to pick up" note, by item id, kept current. */
export function useResumeNotes(): Record<string, ResumeNote> {
    useEffect(() => { void loadResumeNotes(); }, []);
    return useSyncExternalStore(subscribeResumeNotes, currentResumeNotes, currentResumeNotes);
}
