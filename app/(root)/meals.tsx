import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TimeRow } from '@/components/ui/TimeRow';
import { useTokens } from '@/hooks/useTokens';
import { useMeals, useMealsFlexible } from '@/hooks/useMeals';
import { useCalendarOn } from '@/hooks/useCalendarEvents';
import { MEAL_NAMES, saveMeal, setMealsFlexible, type MealId } from '@/lib/meals';
import { MealRow } from '@/components/Roadmap/MealRow';
import { cachedDayWindow, DEFAULT_DAY, getDayWindow, updateDayWindow, type DayWindow } from '@/lib/echo';
import { explainCalendarRefused, setCalendarOn } from '@/lib/calendarEvents';
import { NotificationService } from '@/lib/notificationService';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { saveDailyTarget } from '@/lib/dailyFocus';
import { setWeekStart, type WeekStart } from '@/lib/weekStart';
import { useWeekStart } from '@/hooks/useWeekStart';
import { syncBrainDumpReview } from '@/lib/brainDumpReview';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useHaptics } from '@/hooks/useHaptics';
import { styles } from '@/styles/screens/meals.styles';


/**
 * Day & calendar: what the timeline is built around, and the one place each
 * of these is set. When your day starts and ends (Notifications, the morning
 * alarm and the Bedtime lock all read these hours), how it is planned, your
 * calendar and your meals. Habits and tasks with no time are fitted into what
 * is left, most urgent first; meals and events never move.
 */
export default function TimelineSettingsScreen() {
    const t = useTokens();
    const meals = useMeals();
    const flexible = useMealsFlexible();
    const anyMeal = Object.values(meals).some(meal => meal.on);
    const calendar = useCalendarOn();
    const dailyTarget = useDailyTarget();
    const weekStart = useWeekStart();
    const { autoReschedule, setAutoReschedule } = useAppSettings();
    const { lightFeedback } = useHaptics();
    // The same saved day as Notifications: one copy (lib/echo.ts), never the default first.
    const [day, setDay] = useState<DayWindow>(() => cachedDayWindow() ?? DEFAULT_DAY);
    useEffect(() => { void getDayWindow().then(setDay); }, []);
    // Nothing rings while you sleep (lib/sleepWindow.ts), so reminders are rescheduled with it.
    // Only the end that was changed is saved; the other stays as it was saved.
    const saveDay = (patch: Partial<DayWindow>) => { setDay(current => ({ ...current, ...patch })); void updateDayWindow(patch).then(saved => { setDay(saved); return NotificationService.refreshReminders(); }).catch(() => undefined); };

    const toggleCalendar = async (next: boolean) => {
        const done = await setCalendarOn(next);
        if (!done && next) explainCalendarRefused();
    };

    return (
        <SheetScreen title="Day & calendar" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle first>Your day</SectionTitle>
                <View>
                    <TimeRow icon="sunny-outline" label="Wake up" value={day.wake} accent={t.color.accent} onChange={time => saveDay({ wake: time })} />
                    <TimeRow icon="moon-outline" label="Bedtime" value={day.sleep} accent={t.color.accent} onChange={time => saveDay({ sleep: time })} />
                </View>

                {/* How the day is planned. */}
                <SettingsGroup title="Planning">
                    <SettingsRow icon="checkmark-done" color={t.color.warning} label="Tasks a day"
                        choices={[{ id: '3', label: '3' }, { id: '5', label: '5' }]}
                        chosen={String(dailyTarget)} onChoose={id => void saveDailyTarget(Number(id) as 3 | 5)} />
                    {/* Whether the timeline moves things for you. Off, it is a plain calendar:
                        everything stays at its time and what has no time waits in Anytime. */}
                    <SettingsRow icon="shuffle" color={t.color.success} label="Auto-reschedule"
                        toggle={autoReschedule} onToggle={value => { lightFeedback(); setAutoReschedule(value); }} />
                    {/* When a week ends: calendars start on it and the brain dump is reviewed then. */}
                    <SettingsRow icon="calendar" color={t.color.accent} label="Week starts"
                        choices={[{ id: 'monday', label: 'Mon' }, { id: 'sunday', label: 'Sun' }]} chosen={weekStart}
                        onChoose={id => { void setWeekStart(id as WeekStart).then(() => syncBrainDumpReview()); }} />
                </SettingsGroup>

                <SettingsGroup title="Calendar">
                    <SettingsRow icon="calendar" color={t.color.danger} label="Use my calendar"
                        toggle={calendar} onToggle={value => void toggleCalendar(value)} />
                </SettingsGroup>

                {/* Meals: one tidy line each; tap one to set its time and length. */}
                {/* Flexible sits by the title: it is about every meal, so it is no row of its own. */}
                <SettingsGroup title="Meals"
                    toggle={anyMeal ? { label: 'Flexible', value: flexible, onChange: value => void setMealsFlexible(value) } : undefined}>
                    {(Object.keys(MEAL_NAMES) as MealId[]).map(id => (
                        <MealRow key={id} meal={meals[id]} onChange={patch => void saveMeal(id, patch)} />
                    ))}
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}
