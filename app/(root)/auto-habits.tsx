import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { AppButton, IconTile, ListItem, StepSlider, Text, VoidCard } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { addHabit, getHabits, syncHealthKitData, updateHabit, type Habit } from '@/lib/habitsSQLite';
import { HEALTH_METRICS, type HealthMetric, type HealthMetricInfo } from '@/lib/healthMetrics';
import { HealthKitService } from '@/lib/HealthKitService';
import { localDateKey } from '@/lib/habitSchedule';
import { styles } from '@/styles/screens/auto-habits.styles';

const say = (info: HealthMetricInfo) => (value: number) => `${value.toLocaleString()} ${info.habit.unit === 'hours' ? (value === 1 ? 'hour' : 'hours') : info.habit.unit}`;

/**
 * Habits Habyss tracks by itself: each one Apple Health already counts (steps,
 * exercise, sleep, mindful minutes, distance, stairs, active calories), from
 * the iPhone, the Watch and every app that writes into Health. Pick the target,
 * add it, and it ticks itself as the day goes (lib/habitsSQLite.ts
 * syncHealthKitData): no tap, nothing to remember. One already added shows its
 * target, which can be changed here.
 */
export default function AutoHabits() {
    const t = useTokens();
    const { mediumFeedback } = useHaptics();
    const [linked, setLinked] = useState<Partial<Record<HealthMetric, Habit>>>({});
    const [targets, setTargets] = useState<Partial<Record<HealthMetric, number>>>({});

    const load = useCallback(async () => {
        const habits = await getHabits().catch(() => [] as Habit[]);
        const found: Partial<Record<HealthMetric, Habit>> = {};
        for (const habit of habits) if (habit.healthKitMetric && !habit.isArchived && !habit.isGoal) found[habit.healthKitMetric] = habit;
        setLinked(found);
    }, []);
    useEffect(() => {
        void load();
        const sub = on('habit_updated', load);
        return () => sub.remove();
    }, [load]);

    const targetOf = (info: HealthMetricInfo) => targets[info.id] ?? linked[info.id]?.healthKitTarget ?? linked[info.id]?.goalValue ?? info.habit.target;

    const add = async (info: HealthMetricInfo) => {
        mediumFeedback();
        const target = targetOf(info);
        // Health is asked only now, for what was just chosen.
        await HealthKitService.init().catch(() => false);
        await addHabit({
            name: info.habit.name, icon: info.habit.icon, trackingMethod: 'numeric', unit: info.habit.unit,
            goalValue: target, healthKitMetric: info.id, healthKitTarget: target,
            startDate: localDateKey(new Date()), taskDays: [], frequency: 'daily', goalPeriod: 'daily',
        });
        emit('habit_updated', {});
        void syncHealthKitData().catch(() => 0);
    };
    const change = (info: HealthMetricInfo, value: number) => {
        setTargets(current => ({ ...current, [info.id]: value }));
        const habit = linked[info.id];
        if (habit) void updateHabit({ ...habit, goalValue: value, healthKitTarget: value }).then(() => emit('habit_updated', {}));
    };

    return (
        <SheetScreen title="Automatic habits" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.intro}>
                    <Text variant="bodySmall" tone="muted">
                        These tick themselves from Apple Health, as your iPhone, Watch and apps count them. Set the target and add it.
                    </Text>
                </View>
                {HEALTH_METRICS.map((info, index) => {
                    const habit = linked[info.id];
                    const target = targetOf(info);
                    const values = info.habit.targets.includes(target) ? info.habit.targets : [...info.habit.targets, target].sort((a, b) => a - b);
                    return (
                        <ListItem key={info.id} index={index}>
                            <VoidCard style={styles.card}>
                                <View style={styles.head}>
                                    <IconTile icon={info.habit.icon} color={t.color.accent} />
                                    <View style={styles.text}>
                                        <Text variant="heading">{info.habit.name}</Text>
                                        <Text variant="caption" tone="muted">{info.detail}</Text>
                                    </View>
                                </View>
                                <StepSlider label="Every day" values={values} value={target} onChange={value => change(info, value)} say={say(info)} />
                                {habit
                                    ? <AppButton label="Added: ticks itself" icon="checkmark" variant="default" disabled onPress={() => undefined} />
                                    : <AppButton label={`Add ${info.habit.name}`} variant="primary" onPress={() => void add(info)} />}
                            </VoidCard>
                        </ListItem>
                    );
                })}
            </ScrollView>
        </SheetScreen>
    );
}
