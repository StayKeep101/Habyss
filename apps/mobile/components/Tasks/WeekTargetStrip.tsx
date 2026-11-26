import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { VoidCard } from '@/components/ui/VoidCard';
import { useTokens } from '@/hooks/useTokens';
import type { WeekTargetDay } from '@/lib/dailyFocus';
import { textOn } from '@/theme/tokens';

const letter = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
const weekday = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });

/**
 * A week against the daily 3 (or 5): one mark per day. A day that got its
 * tasks done is a solid disc with a tick; a day short of it, a ring closed as
 * far as it got with the count inside; a day still ahead, a faint ring. Under
 * it, how many days of the week made it.
 */
export function WeekTargetStrip({ days, today }: { days: WeekTargetDay[]; today: string }) {
    const t = useTokens();
    const target = days[0]?.target ?? 3;
    const counted = days.filter(day => !day.future);
    const hits = counted.filter(day => day.hit).length;
    const size = t.space['3xl'] + t.space.xs;
    return (
        <VoidCard style={[styles.card, { padding: t.space.lg, gap: t.space.md }]}>
            <View style={styles.row}>
                {days.map(day => {
                    const isToday = day.date === today;
                    const label = day.future ? `${weekday(day.date)}, still ahead`
                        : `${weekday(day.date)}: ${day.done} of ${target} tasks${day.hit ? ', done' : ''}`;
                    return (
                        <View key={day.date} style={[styles.day, { gap: t.space.xs }]} accessible accessibilityLabel={label}>
                            <Text variant="caption" tone={isToday ? 'primary' : 'muted'}>{letter(day.date)}</Text>
                            {day.hit ? (
                                <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.color.accent }]}>
                                    <AppIcon name="checkmark" size={t.space.lg} color={textOn(t.color.accent)} />
                                </View>
                            ) : (
                                <View style={{ opacity: day.future ? 0.35 : 1 }}>
                                    <ProgressRing size="sm" progress={day.done / target} label={day.future ? undefined : `${day.done}`} />
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
            <Text variant="caption" tone="muted" align="center">
                {`${hits} of ${counted.length} ${counted.length === 1 ? 'day' : 'days'} with your ${target} done`}
            </Text>
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: {},
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    day: { flex: 1, alignItems: 'center' },
    disc: { alignItems: 'center', justifyContent: 'center' },
});
