import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TimeRow } from '@/components/ui/TimeRow';
import { useTokens } from '@/hooks/useTokens';
import { useMeals } from '@/hooks/useMeals';
import { useCalendarOn } from '@/hooks/useCalendarEvents';
import { MEAL_LENGTHS, MEAL_NAMES, saveMeal, type MealId } from '@/lib/meals';
import { DEFAULT_DAY, getDayWindow, saveDayWindow, type DayWindow } from '@/lib/echo';
import { calendarAvailable, setCalendarOn } from '@/lib/calendarEvents';
import { NotificationService } from '@/lib/notificationService';
import { styles } from '@/styles/screens/meals.styles';

const ICONS: Record<MealId, 'cafe' | 'restaurant' | 'fast-food'> = { breakfast: 'cafe', lunch: 'restaurant', supper: 'fast-food' };

/**
 * What the timeline is built around: when your day starts and ends, your
 * meals, and your calendar. Habits and tasks with no time are fitted into
 * what is left, most urgent first; meals and events never move.
 */
export default function TimelineSettingsScreen() {
    const t = useTokens();
    const meals = useMeals();
    const calendar = useCalendarOn();
    const [day, setDay] = useState<DayWindow>(DEFAULT_DAY);
    useEffect(() => { void getDayWindow().then(setDay); }, []);
    // Quiet hours follow the same day, so reminders are rescheduled with it.
    const saveDay = (next: DayWindow) => { setDay(next); void saveDayWindow(next).then(() => NotificationService.refreshReminders()).catch(() => undefined); };

    const toggleCalendar = async (next: boolean) => {
        const done = await setCalendarOn(next);
        if (!done && next) Alert.alert('Calendar not connected', calendarAvailable()
            ? 'Allow Habyss to see your calendar in iOS Settings → Privacy & Security → Calendars, then switch it on here.'
            : 'This version of Habyss cannot read the calendar.');
    };

    return (
        <SheetScreen title="Timeline" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[t.type.bodySmall, { color: t.color.textMuted }]}>
                    Habits and tasks without a set time are fitted into your day, most urgent first, between waking and bedtime. Meals and calendar events never move, and nothing is pushed into them.
                </Text>

                <SectionTitle>Your day</SectionTitle>
                <View>
                    <TimeRow icon="sunny-outline" label="Wake up" value={day.wake} accent={t.color.accent} onChange={time => saveDay({ ...day, wake: time })} />
                    <TimeRow icon="moon-outline" label="Bedtime" value={day.sleep} accent={t.color.accent} onChange={time => saveDay({ ...day, sleep: time })} />
                </View>

                <SettingsGroup title="Calendar">
                    <SettingsRow icon="calendar" color={t.color.danger} label="Use my calendar"
                        toggle={calendar} onToggle={value => void toggleCalendar(value)} />
                </SettingsGroup>
                <Text style={[t.type.caption, { color: t.color.textSubtle }]}>
                    Events from Apple Calendar, and any Google or Outlook account on this iPhone, show in your timeline. All-day and “free” events do not block time. Read on this phone only.
                </Text>

                {(Object.keys(MEAL_NAMES) as MealId[]).map(id => {
                    const meal = meals[id];
                    return (
                        <View key={id}>
                            <SettingsGroup title={MEAL_NAMES[id]}>
                                <SettingsRow icon={ICONS[id]} color={t.color.warning} label="In my timeline"
                                    toggle={meal.on} onToggle={on => void saveMeal(id, { on })} />
                                {meal.on ? (
                                    <SettingsRow icon="hourglass" color={t.color.accent} label="Takes"
                                        choices={MEAL_LENGTHS.map(minutes => ({ id: String(minutes), label: `${minutes}m` }))}
                                        chosen={String(meal.minutes)} onChoose={value => void saveMeal(id, { minutes: Number(value) })} />
                                ) : null}
                            </SettingsGroup>
                            {meal.on ? (
                                <TimeRow icon="time" label="At" value={meal.time} accent={t.color.accent} onChange={time => void saveMeal(id, { time })} />
                            ) : null}
                        </View>
                    );
                })}
            </ScrollView>
        </SheetScreen>
    );
}
