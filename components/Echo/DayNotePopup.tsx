import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, AppTextField } from '@/components/ui';
import { PopupCard } from '@/components/ui/PopupCard';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { localDateKey } from '@/lib/habitSchedule';
import { dayNoteTime, loadDayNotes, scheduleDayNotePrompt, setDayNote, shouldAskDayNote, skipDayNote } from '@/lib/dayNote';
import { FeedService } from '@/lib/feedService';

/** Your post time is read from the server at most once a launch. */
let fetched = false;
import { Spacing } from '@/theme/designSystem';

/**
 * Your day is up: the first time you open the app after your post time, the
 * same card as Echo's quick questions rises with the keyboard already open,
 * asking how it went. The words go on the last card of your day
 * (lib/dayNote.ts). "Not today" puts it away until tomorrow.
 */
export function DayNotePopup() {
    const { primary } = useAccentGradient();
    const { successFeedback, lightFeedback } = useHaptics();
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
        <PopupCard visible={!!day} onClose={() => { lightFeedback(); close(); }} icon="book" iconColor={primary} typing
            title="How did today go?" body="Your day is up. A few words go on its last card.">
            <AppTextField value={text} onChangeText={setText} multiline autoFocus maxLength={600}
                placeholder="What happened, how it felt…" accessibilityLabel="Your thoughts on today" />
            <View style={styles.actions}>
                <View style={styles.flex}><AppButton label="Not today" variant="ghost" onPress={() => { lightFeedback(); close(); }} /></View>
                <View style={styles.flex}>
                    <AppButton label="Add to my day" icon="checkmark" variant="primary" disabled={!text.trim()}
                        onPress={() => { successFeedback(); if (day) void setDayNote(day, text); setDay(null); setText(''); }} />
                </View>
            </View>
        </PopupCard>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
});
