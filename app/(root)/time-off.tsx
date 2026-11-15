import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { AppButton, ChoiceRow, DateWheels, IconTile, ListItem, Text, VoidCard } from '@/components/ui';
import { TIME_OFF_ICON } from '@/components/Home/TimeOffCard';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useTimeOff } from '@/hooks/useTimeOff';
import { localDateKey } from '@/lib/habitSchedule';
import { endTimeOff, startTimeOff, TIME_OFF_MAX_DAYS, timeOffLabel } from '@/lib/timeOff';
import { styles } from '@/styles/screens/time-off.styles';

type Length = 3 | 7 | 14 | 'date';
const LENGTHS: { id: Length; label: string }[] = [
    { id: 3, label: '3 days' }, { id: 7, label: '1 week' }, { id: 14, label: '2 weeks' }, { id: 'date', label: 'Until…' },
];
const inDays = (days: number) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + days); return date; };
const dayName = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * Time off: sick, or away. Life happens, and the app should not punish it.
 * While it runs the streak is kept, what is left undone is not missed, and
 * nothing buzzes but a task's own reminder (lib/timeOff.ts). Sick runs until
 * you say you're back; a vacation until its last day.
 */
export default function TimeOffScreen() {
    const t = useTokens();
    const { mediumFeedback } = useHaptics();
    const running = useTimeOff();
    const [length, setLength] = useState<Length>(7);
    const [until, setUntil] = useState(() => inDays(7));
    // The last day away: "1 week" from today is back on the 8th, so its last day off is the 7th.
    const lastDay = length === 'date' ? until : inDays(length - 1);

    const start = (kind: 'sick' | 'vacation') => {
        mediumFeedback();
        startTimeOff(kind, kind === 'sick' ? null : localDateKey(lastDay));
        router.back();
    };

    return (
        <SheetScreen title="Time off" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.intro}>
                    <Text variant="bodySmall" tone="muted">
                        Sick or away? Your streak is kept, nothing counts as missed, and reminders go quiet. A task's own reminder still rings.
                    </Text>
                </View>
                {running ? (
                    <ListItem index={0}>
                        <VoidCard style={styles.card}>
                            <View style={styles.head}>
                                <IconTile icon={TIME_OFF_ICON[running.kind]} color={t.color.accent} />
                                <View style={styles.text}>
                                    <Text variant="heading">{timeOffLabel(running)}</Text>
                                    <Text variant="caption" tone="muted">Your streak is safe.</Text>
                                </View>
                            </View>
                            <AppButton label="I'm back" variant="primary" onPress={() => { mediumFeedback(); endTimeOff(); }} />
                        </VoidCard>
                    </ListItem>
                ) : (
                    <>
                        <ListItem index={0}>
                            <VoidCard style={styles.card}>
                                <View style={styles.head}>
                                    <IconTile icon={TIME_OFF_ICON.sick} color={t.color.accent} />
                                    <View style={styles.text}>
                                        <Text variant="heading">I'm sick</Text>
                                        <Text variant="caption" tone="muted">From today until you say you're back.</Text>
                                    </View>
                                </View>
                                <AppButton label="Rest from today" variant="primary" onPress={() => start('sick')} />
                            </VoidCard>
                        </ListItem>
                        <ListItem index={1}>
                            <VoidCard style={styles.card}>
                                <View style={styles.head}>
                                    <IconTile icon={TIME_OFF_ICON.vacation} color={t.color.accent} />
                                    <View style={styles.text}>
                                        <Text variant="heading">Vacation</Text>
                                        <Text variant="caption" tone="muted">{`From today, last day ${dayName(lastDay)}.`}</Text>
                                    </View>
                                </View>
                                <ChoiceRow options={LENGTHS} value={length} onChange={setLength} accessibilityLabel="How long" />
                                {length === 'date' ? (
                                    <DateWheels value={until} minYear={new Date().getFullYear()} maxDate={inDays(TIME_OFF_MAX_DAYS - 1)}
                                        onChange={date => setUntil(date < inDays(0) ? inDays(0) : date)} />
                                ) : null}
                                <AppButton label="Start vacation" variant="primary" onPress={() => start('vacation')} />
                            </VoidCard>
                        </ListItem>
                    </>
                )}
            </ScrollView>
        </SheetScreen>
    );
}
