import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { NotePopup } from '@/components/ui';
import { useAccentGradient } from '@/context/AccentContext';
import { localDateKey } from '@/lib/habitSchedule';
import { dayNoteTime, loadDayNotes, scheduleDayNotePrompt, setDayNote, shouldAskDayNote, skipDayNote } from '@/lib/dayNote';
import { FeedService } from '@/lib/feedService';

/** Your post time is read from the server at most once a launch. */
let fetched = false;

/**
 * Your day is up: the first time you open the app after your post time, the
 * same card as Echo's quick questions rises with the keyboard already open,
 * asking how it went. The words go on the last card of your day
 * (lib/dayNote.ts). "Not today" puts it away until tomorrow.
 */
export function DayNotePopup() {
    const { primary } = useAccentGradient();
    const [day, setDay] = useState<string | null>(null);
    const [text, setText] = useState('');

    const check = useCallback(() => {
        void (async () => {
            await loadDayNotes();
            const now = new Date();
            const today = localDateKey(now);
            let time = await dayNoteTime();
            // Not known on this phone yet (Community never opened): read it once from your settings.
            if (!time && !fetched) {
                fetched = true;
                const settings = await FeedService.shareSettings().catch(() => null);
                if (settings) { await scheduleDayNotePrompt(settings.time, settings.enabled); time = settings.enabled ? settings.time : null; }
            }
            if (shouldAskDayNote(time, now, today)) setDay(current => current ?? today);
        })();
    }, []);
    useFocusEffect(useCallback(() => { check(); }, [check]));
    useEffect(() => {
        const subscription = AppState.addEventListener('change', next => { if (next === 'active') check(); });
        return () => subscription.remove();
    }, [check]);

    const close = () => { if (day) void skipDayNote(day); setDay(null); setText(''); };
    return (
        <NotePopup visible={!!day} onClose={close} icon="book" iconColor={primary}
            title="How did today go?" body="A few words go on your day's last card."
            value={text} onChangeText={setText} placeholder="What happened, how it felt…" label="Your thoughts on today"
            skipLabel="Not today" saveLabel="Add it"
            onSave={() => { if (day) void setDayNote(day, text); setDay(null); setText(''); }} />
    );
}
