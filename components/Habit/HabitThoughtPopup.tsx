import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { NotePopup } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettingsContext';
import { on } from '@/lib/appEvents';
import { getHabits } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { forgetHabitThoughts, setHabitThought } from '@/lib/habitThoughts';
import { readableAccent } from '@/lib/colorContrast';
import { Colors } from '@/theme/colors';
import { DURATION } from '@/theme/motion';
import { useTheme } from '@/context/ThemeContext';

type Asking = { habitId: string; name: string; color: string; icon: string; date: string };

/**
 * You just ticked a habit: the card rises with the keyboard open, asking how
 * it went. The words are kept with the habit and read back on its page
 * (lib/habitThoughts.ts). Only for a tick you made with the app open (not
 * one Apple Health or a place made for you), today's, one at a time; "Skip"
 * puts it away. Taken back if the tick is.
 */
export function HabitThoughtPopup() {
    const { theme } = useTheme();
    const { askThoughts } = useAppSettings();
    const askRef = useRef(askThoughts);
    useEffect(() => { askRef.current = askThoughts; }, [askThoughts]);
    const [asking, setAsking] = useState<Asking | null>(null);
    const [text, setText] = useState('');
    const open = useRef<string | null>(null);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const sub = on('habit_completion_updated', ({ habitId, date, completed, skipped }) => {
            if (!habitId) return;
            // Untick it while the card is up: the card goes.
            if (!completed || skipped) {
                if (open.current === habitId) { open.current = null; setAsking(null); setText(''); }
                return;
            }
            // Turned off in Settings → Day & calendar.
            if (!askRef.current || open.current || AppState.currentState !== 'active') return;
            const today = localDateKey(new Date());
            if (date && date !== today) return;
            // A beat after the tick, so its own celebration plays first.
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                void getHabits().then(habits => {
                    const habit = habits.find(item => item.id === habitId);
                    if (!habit || open.current) return;
                    // Ticked for you by Apple Health or by time at a place: nothing to ask.
                    if (habit.healthKitMetric || habit.locationReminders?.some(place => place.trigger === 'stay')) return;
                    open.current = habitId;
                    setAsking({ habitId, name: habit.name, color: habit.color || Colors[theme].textPrimary, icon: habit.icon || 'checkmark-circle', date: date ?? today });
                }).catch(() => undefined);
            }, DURATION.reward);
        });
        // A habit deleted takes its thoughts with it.
        const gone = on('habit_deleted', ({ habitId }) => { void forgetHabitThoughts(habitId); });
        return () => { sub.remove(); gone.remove(); if (timer) clearTimeout(timer); };
    }, [theme]);

    const close = () => { open.current = null; setAsking(null); setText(''); };
    const color = asking ? readableAccent(asking.color, Colors[theme].background) : Colors[theme].textPrimary;
    return (
        <NotePopup visible={!!asking} onClose={close} icon={asking?.icon ?? 'checkmark-circle'} iconColor={color}
            title={asking ? `${asking.name}, done` : ''} body="How did it go?"
            value={text} onChangeText={setText} placeholder="What you noticed, how it felt…" label={`Your thoughts on ${asking?.name ?? 'this habit'}`}
            onSave={() => { if (asking) void setHabitThought(asking.habitId, asking.date, text); close(); }} />
    );
}
