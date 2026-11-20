import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { AppButton, IconTile, ListItem, SectionTitle, StepSlider, Text, VoidCard } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { addHabit, getHabits, syncHealthKitData, updateHabit, type Habit } from '@/lib/habitsSQLite';
import { HEALTH_METRICS, isWorkoutMetric, type HealthMetric, type HealthMetricInfo } from '@/lib/healthMetrics';
import { HealthKitService } from '@/lib/HealthKitService';
import { APP_TIME_IDEAS, appTimeSupported, chooseApps, getAppTime, setAppTime, type AppTimeIdea } from '@/lib/appTime';
import { generateId } from '@/lib/database';
import { localDateKey } from '@/lib/habitSchedule';
import { styles } from '@/styles/screens/auto-habits.styles';

const say = (info: HealthMetricInfo) => (value: number) => `${value.toLocaleString()} ${info.habit.unit === 'hours' ? (value === 1 ? 'hour' : 'hours') : info.habit.unit}`;
const minutes = (value: number) => (value >= 60 && value % 60 === 0 ? `${value / 60} hr` : `${value} min`);

/**
 * Habits Habyss tracks by itself, no tap needed:
 * - from Apple Health: the day's numbers (steps, sleep…) and workouts by kind,
 *   from the iPhone, the Watch and every app that writes into Health
 *   (syncHealthKitData);
 * - from your apps: time in the apps you choose ticks "Read", or keeps "Less
 *   social media" (lib/appTime.ts, with the build that has it);
 * - places: any habit or task set to Stay at a place ticks itself after time
 *   there (its reminder, lib/LocationService.ts).
 */
export default function AutoHabits() {
    const t = useTokens();
    const { mediumFeedback } = useHaptics();
    const [linked, setLinked] = useState<Partial<Record<HealthMetric, Habit>>>({});
    const [targets, setTargets] = useState<Partial<Record<string, number>>>({});
    const [appHabits, setAppHabits] = useState<Record<string, Habit>>({});

    const load = useCallback(async () => {
        const habits = await getHabits().catch(() => [] as Habit[]);
        const found: Partial<Record<HealthMetric, Habit>> = {};
        for (const habit of habits) if (habit.healthKitMetric && !habit.isArchived && !habit.isGoal) found[habit.healthKitMetric] = habit;
        setLinked(found);
        // Which ideas are already watched, by the habit's name.
        const timed = await getAppTime();
        const byIdea: Record<string, Habit> = {};
        for (const habit of habits) {
            if (!timed[habit.id] || habit.isArchived) continue;
            const idea = APP_TIME_IDEAS.find(item => item.name === habit.name);
            if (idea) byIdea[idea.id] = habit;
        }
        setAppHabits(byIdea);
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
        // Health is asked only now, for what was just chosen (workouts only once one is added).
        await (isWorkoutMetric(info.id) ? HealthKitService.wantWorkouts() : HealthKitService.init()).catch(() => false);
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

    const appMinutes = (idea: AppTimeIdea) => targets[`app:${idea.id}`] ?? idea.minutes;
    const addAppHabit = async (idea: AppTimeIdea) => {
        mediumFeedback();
        const id = generateId();
        const chosen = await chooseApps(id, idea.pick);
        if (chosen <= 0) {
            if (chosen === 0) Alert.alert('No apps chosen', 'Pick at least one app, or a whole category, for it to count.');
            return;
        }
        await addHabit({
            id, name: idea.name, icon: idea.icon, type: idea.quit ? 'quit' : 'build',
            startDate: localDateKey(new Date()), taskDays: [], frequency: 'daily', goalPeriod: 'daily',
        });
        await setAppTime(id, appMinutes(idea));
        emit('habit_updated', {});
    };
    const changeApp = (idea: AppTimeIdea, value: number) => {
        setTargets(current => ({ ...current, [`app:${idea.id}`]: value }));
        const habit = appHabits[idea.id];
        if (habit) void setAppTime(habit.id, value);
    };

    const healthCard = (info: HealthMetricInfo, index: number) => {
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
    };

    const body = HEALTH_METRICS.filter(info => !info.group);
    const workouts = HEALTH_METRICS.filter(info => info.group === 'workout');

    return (
        <SheetScreen title="Automatic habits" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.intro}>
                    <Text variant="bodySmall" tone="muted">These tick themselves. Set the target and add it.</Text>
                </View>

                {appTimeSupported() ? (
                    <>
                        <SectionTitle first>From your apps</SectionTitle>
                        {APP_TIME_IDEAS.map((idea, index) => {
                            const habit = appHabits[idea.id];
                            const value = appMinutes(idea);
                            const values = idea.choices.includes(value) ? idea.choices : [...idea.choices, value].sort((a, b) => a - b);
                            return (
                                <ListItem key={idea.id} index={index}>
                                    <VoidCard style={styles.card}>
                                        <View style={styles.head}>
                                            <IconTile icon={idea.icon} color={idea.quit ? t.color.warning : t.color.accent} />
                                            <View style={styles.text}>
                                                <Text variant="heading">{idea.name}</Text>
                                                <Text variant="caption" tone="muted">{idea.detail}</Text>
                                            </View>
                                        </View>
                                        <StepSlider label={idea.quit ? 'At most' : 'Every day'} values={values} value={value} onChange={next => changeApp(idea, next)} say={minutes} />
                                        {habit
                                            ? <AppButton label="Change apps" icon="apps" variant="default" onPress={() => void chooseApps(habit.id, idea.pick).then(() => setAppTime(habit.id, value))} />
                                            : <AppButton label="Choose apps & add" variant="primary" onPress={() => void addAppHabit(idea)} />}
                                    </VoidCard>
                                </ListItem>
                            );
                        })}
                    </>
                ) : null}

                <SectionTitle first={!appTimeSupported()}>Workouts</SectionTitle>
                {workouts.map(healthCard)}

                <SectionTitle>Your day</SectionTitle>
                {body.map(healthCard)}

                <SectionTitle>Places</SectionTitle>
                <Text variant="bodySmall" tone="muted">
                    Any habit or task: set its reminder to a place and choose Stay. It ticks itself after that long there.
                </Text>
            </ScrollView>
        </SheetScreen>
    );
}
